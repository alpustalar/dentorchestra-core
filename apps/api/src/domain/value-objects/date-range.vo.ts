/* eslint-disable */
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { TimeConflictException } from '@src/domain/exceptions';
import { Guard } from '@common/domain/guards';
import {
  DateRangeExpiredException,
  InvalidDateRangeException,
} from '@src/domain/exceptions/date-range.exceptions';

export class DateRange {
  private readonly _startDate: Date;
  private readonly _endDate: Date;

  private constructor(startDate: Date, endDate: Date) {
    this._startDate = DateTimeManager.create(startDate);
    this._endDate = DateTimeManager.create(endDate);
    Object.freeze(this);
  }

  /**
   * henüz nesne yaratılmadan ham tarihleri doğrular
   * Örn: DateRange.validate.range(start, end).orThrow()
   */
  public static get validate() {
    return {
      range: (startDate?: Date, endDate?: Date) => {
        let hasError: boolean;
        if (!startDate || !endDate) {
          hasError = true;
        } else {
          hasError =
            DateTimeManager.isBefore(endDate, startDate) ||
            DateTimeManager.isSame(endDate, startDate);
        }

        const isValid = !hasError;

        return Guard.monitor(
          isValid,
          isValid,
          () => new InvalidDateRangeException()
        );
      },
    };
  }

  get startDate(): Date {
    return DateTimeManager.create(this._startDate.getTime());
  }

  get endDate(): Date {
    return DateTimeManager.create(this._endDate.getTime());
  }

  /**
   * Üretilmiş tarih aralığı üzerindeki iş kurallarını işletir
   * Örn: appointmentRange.validate.conflict(existingRange, 'Mesaiden sonra rdv verilemez').orThrow()
   */
  public get validate() {
    return {
      isEnclosingWith: (other: DateRange) => {
        const isValid = this.isEnclosing(other);

        return Guard.monitor(
          isValid,
          isValid,
          () => new Error('Belirtilen zaman aralığı hedef aralığı kapsamıyor.')
        );
      },
      expiration: (exception) => {
        const now = DateTimeManager.create();
        const isValid = !DateTimeManager.isBefore(this._endDate, now);

        const throwEx = exception() ?? new DateRangeExpiredException();

        return Guard.monitor(isValid, isValid, () => throwEx);
      },

      isOverlappingWith: (other: DateRange, throwMsg?: string) => {
        const isOverlapping = DateTimeManager.isOverlapping(
          { start: this._startDate, end: this._endDate },
          { start: other._startDate, end: other._endDate }
        );

        const isValid = !isOverlapping;

        return Guard.monitor(
          isValid,
          isValid,
          () => new TimeConflictException(throwMsg)
        );
      },
      isEqualWith: (otherRange: DateRange) => {
        const isEqual = this.isEqualWith(otherRange);
        return Guard.monitor(
          isEqual,
          isEqual,
          () => new Error('Tarihler birbirine eşit değil')
        );
      },
    };
  }

  get durationInMinutes(): number {
    return DateTimeManager.diffInMinutes(this._endDate, this._startDate);
  }

  get durationInFullDays(): number {
    return DateTimeManager.diffInDays(this._endDate, this._startDate) + 1;
  }

  /**
   * 🎯 Güvenilir Kurucu: Persisted (DB) tarihlerden doğrudan VO üretir; sıra doğrulaması atlanır.
   */
  public static fromTrusted(startDate: Date, endDate: Date): DateRange {
    return new DateRange(startDate, endDate);
  }

  public static create(
    startDate: Date | null | undefined,
    endDate: Date | null | undefined
  ) {
    const isBlank = !startDate || !endDate;

    let instance: DateRange | undefined;
    let error: Error | undefined;

    if (!isBlank) {
      try {
        DateRange.validate.range(startDate, endDate).orThrow();
        instance = new DateRange(startDate, endDate);
      } catch (e: any) {
        error = e;
      }
    }

    return {
      instance: error ? undefined : instance,

      orThrow(exception?: Error): DateRange {
        if (error || !instance) {
          throw exception ?? error ?? new InvalidDateRangeException();
        }
        return instance;
      },
    };
  }

  private isEqualWith(other: DateRange) {
    return (
      this._startDate.getTime() === other._startDate.getTime() &&
      this._endDate.getTime() === other._endDate.getTime()
    );
  }

  private isEnclosing(other: DateRange): boolean {
    return this._startDate >= other.startDate && this._endDate <= other.endDate;
  }
}
