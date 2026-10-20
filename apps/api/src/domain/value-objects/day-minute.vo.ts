import { Guard } from '@common/domain/guards';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  DayMinuteOutOfRangeException,
  InvalidTimeValueException,
} from '@src/domain/exceptions';
import { z } from 'zod';
import { isEmpty } from '@common/utils';

export class DayMinute {
  private static readonly schema = z.number().int().min(0).max(1440);

  private constructor(minute: number) {
    this._value = minute;
  }

  private _value: number;

  get value(): number {
    return this._value;
  }

  public get validate() {
    return {
      isAfter: (other: DayMinute, errorMessage?: string) =>
        this.monitor(this.isAfter(other), errorMessage),
      isBefore: (other: DayMinute, errorMessage?: string) =>
        this.monitor(this.isBefore(other), errorMessage),
      isBeforeOrEqual: (other: DayMinute, errorMessage?: string) =>
        this.monitor(this.isBeforeOrEqual(other), errorMessage),
      isAfterOrEqual: (other: DayMinute, errorMessage?: string) =>
        this.monitor(this.isAfterOrEqual(other), errorMessage),
      isEquals: (other: DayMinute, errorMessage?: string) =>
        this.monitor(this.isEquals(other), errorMessage),
    };
  }

  public static create(minute: number | string | null | undefined) {
    const isBlank = isEmpty(minute);

    // Değeri normalize et (string ise sayıya çevir)
    const normalized =
      typeof minute === 'string' ? parseInt(minute, 10) : minute;

    const result = !isBlank
      ? DayMinute.schema.safeParse(normalized)
      : undefined;

    const instance = result?.success ? new DayMinute(result.data) : undefined;

    return {
      instance,
      orThrow(exception?: Error): DayMinute {
        if (!instance) {
          throw exception ?? new DayMinuteOutOfRangeException(minute as number);
        }
        return instance;
      },
    };
  }

  public static fromTrusted(minute: number | string) {
    if (typeof minute === 'string') {
      const { number } = minuteStringToMinuteNumber(minute);
      return new DayMinute(number);
    }
    return new DayMinute(minute);
  }

  /** Saf sayıdan VO üretir: DayMinute.fromNumber(540) -> 09:00 */
  public static fromNumber(minute: number | null | undefined) {
    return this.create(minute);
  }

  public static fromDate(date: Date) {
    return this.create(DateTimeManager.getDayMinutes(date));
  }

  /** metinden ("09:30") VO üretir: DayMinute.fromString("09:30") -> 570 */
  public static fromString(timeString: string) {
    const { hours, minutes, number } = minuteStringToMinuteNumber(timeString);

    if (
      isNaN(hours) ||
      isNaN(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      throw new InvalidTimeValueException(timeString);
    }

    return this.create(number);
  }

  public toNumber(): number {
    return this._value;
  }

  /** VO'yu saate çevirir: 570 -> "09:30" (WhatsApp mesajlarında veya UI'da direkt kullanılır) */
  public toString(): string {
    const totalMinutes = this._value ?? 0;
    return DateTimeManager.minutesToHHMM(totalMinutes);
  }

  /** İki zaman arasındaki farkı dakika olarak döner */
  public differenceInMinutes(other: DayMinute): number {
    return Math.abs(this._value - other.toNumber());
  }

  private monitor(result: boolean, errorMessage?: string): Guard<boolean> {
    return Guard.monitor(
      result,
      result,
      () => new Error(errorMessage ?? 'Zaman karşılaştırması sağlanmadı.')
    );
  }

  private isAfter(other: DayMinute): boolean {
    return this._value > other.toNumber();
  }

  private isBefore(other: DayMinute): boolean {
    return this._value < other.toNumber();
  }

  private isBeforeOrEqual(other: DayMinute): boolean {
    return this._value <= other.value;
  }

  private isAfterOrEqual(other: DayMinute): boolean {
    return this._value >= other.value;
  }

  private isEquals(other: DayMinute): boolean {
    return this._value === other.toNumber();
  }
}

function minuteStringToMinuteNumber(timeString: string) {
  const parts = timeString.split(/[:.]/);
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const number = hours * 60 + minutes;
  return {
    number,
    minutes,
    hours,
  };
}
