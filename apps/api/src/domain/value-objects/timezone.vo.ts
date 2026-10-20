import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { TimeZoneType } from '@input-type-schemas/TimeZoneSchema';
import { TimeZoneSchema } from '@shared';
import { InvalidTimeZoneException } from '@src/domain/exceptions';

dayjs.extend(utc);
dayjs.extend(timezone);

export class TimeZone {
  private readonly _value: TimeZoneType;

  private constructor(value: TimeZoneType) {
    this._value = value;
    Object.freeze(this);
  }

  public static get validate() {
    return {
      input: (timezone?: string | null) => {
        const trimmed = timezone?.trim();
        if (!trimmed)
          return { isValid: false, error: 'Zaman dilimi boş olamaz.' };

        try {
          const ianaFormat = TimeZone.toIanaFormat(trimmed);
          // IANA doğrulaması
          Intl.DateTimeFormat(undefined, { timeZone: ianaFormat });

          return { isValid: true, data: TimeZone.toSchemaFormat(trimmed) };
        } catch (e) {
          return { isValid: false, error: `Geçersiz zaman dilimi: ${trimmed}` };
        }
      },
    };
  }

  public get value(): TimeZoneType {
    return this._value;
  }

  // 2. Disiplinli Factory
  public static create(timezone?: string | null) {
    const validation = TimeZone.validate.input(timezone);
    const instance = validation.isValid
      ? new TimeZone(validation.data!)
      : undefined;

    return {
      instance,
      orThrow(exception?: Error): TimeZone {
        if (!instance) {
          throw exception ?? new InvalidTimeZoneException();
        }
        return instance;
      },
    };
  }

  public static fromTrusted(value: TimeZoneType): TimeZone {
    return new TimeZone(value);
  }

  public static default(): TimeZone {
    return new TimeZone(TimeZoneSchema.enum.Europe_Istanbul);
  }

  private static toIanaFormat(value: string): string {
    return value.includes('_') && !value.includes('/')
      ? value.replace('_', '/')
      : value;
  }

  private static toSchemaFormat(value: string): TimeZoneType {
    const formatted =
      value.includes('/') && !value.includes('_')
        ? value.replace('/', '_')
        : value;
    return formatted as TimeZoneType;
  }

  public getOffset(): string {
    return dayjs().tz(TimeZone.toIanaFormat(this._value)).format('Z');
  }

  public equals(other: TimeZone): boolean {
    return this._value === other.value;
  }

  public toString(): string {
    return this._value;
  }
}
