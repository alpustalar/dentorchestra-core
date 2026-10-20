import { ProviderAvailability as IProviderAvailability } from '@model-schema/ProviderAvailabilitySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { DayMinuteRange } from '@src/domain/value-objects/day-minute-range.vo';
import { DayMinute } from '@src/domain/value-objects/day-minute.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  CreateProviderAvailabilityProps,
  UpdateProviderAvailabilityProps,
} from '@modules/clinical/provider/domain/contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { isDefined } from '@common/utils';
import { ProviderAvailabilityRules } from '@modules/clinical/provider/domain/rules/provider-availability.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { DefaultValidateOptions } from '@common/domain/constants/default-options.constant';
import { BreakTimeOutOfRangeException } from '@modules/clinical/provider/domain/exceptions/provider-availability.exceptions';

export class ProviderAvailability extends AggregateRoot {
  constructor(data: IProviderAvailability) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._providerId = UUID.fromTrusted(data.providerId);
    this._dayOfWeek = data.dayOfWeek;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;

    this._availabilityRange = DayMinuteRange.fromTrusted(
      data.startMinute,
      data.endMinute
    );

    this._breakRange =
      isDefined(data.breakStartMinute) && isDefined(data.breakEndMinute)
        ? DayMinuteRange.fromTrusted(data.breakStartMinute, data.breakEndMinute)
        : null;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private Properties & Getters
  // ────────────────────────────────────────────────────────────────────────────
  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _providerId: UUID;
  get providerId(): UUID {
    return this._providerId;
  }

  private _dayOfWeek: number;
  get dayOfWeek(): number {
    return this._dayOfWeek;
  }

  private _availabilityRange: DayMinuteRange;
  get availabilityRange(): DayMinuteRange {
    return this._availabilityRange;
  }

  private _breakRange: DayMinuteRange | null;
  get breakRange(): DayMinuteRange | null {
    return this._breakRange;
  }

  get startMinute(): number {
    return this._availabilityRange.start.toNumber();
  }
  get endMinute(): number {
    return this._availabilityRange.end.toNumber();
  }
  get breakStartMinute(): number | null {
    return this._breakRange?.start.toNumber() ?? null;
  }
  get breakEndMinute(): number | null {
    return this._breakRange?.end.toNumber() ?? null;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date | null;
  get updatedAt(): Date | null {
    return this._updatedAt;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 🚀 Static Create Method (Factory)
  // ────────────────────────────────────────────────────────────────────────────
  public static create(
    props: CreateProviderAvailabilityProps
  ): ProviderAvailability {
    const providerId = UUID.create(props.providerId).orThrow();

    const availabilityRange = DayMinuteRange.create(
      DayMinute.fromNumber(props.startMinute).orThrow(),
      DayMinute.fromNumber(props.endMinute).orThrow()
    ).orThrow();

    const breakRange =
      isDefined(props.breakStartMinute) && isDefined(props.breakEndMinute)
        ? DayMinuteRange.create(
            DayMinute.fromNumber(props.breakStartMinute).orThrow(),
            DayMinute.fromNumber(props.breakEndMinute).orThrow()
          ).orThrow()
        : null;

    // Mola tanımlıysa mesai saatlerinin tamamen içinde kalmalı. Eskiden bu kural
    // yalnız hiç `.parse()` edilmeyen bir Zod `.refine()`'da yaşıyordu (fiilen
    // enforce edilmiyordu); dönüşümle birlikte gerçek zamanlı hale getirildi.
    if (
      breakRange &&
      !breakRange.validate.isCompletelyWithIn(availabilityRange).value
    ) {
      throw new BreakTimeOutOfRangeException(
        breakRange.start.toString(),
        breakRange.end.toString(),
        availabilityRange.start.toString(),
        availabilityRange.end.toString()
      );
    }

    return new ProviderAvailability({
      id: UUID.createOrGenerate(props.id).value,
      providerId: providerId.value,
      dayOfWeek: props.dayOfWeek,
      startMinute: availabilityRange.start.toNumber(),
      endMinute: availabilityRange.end.toNumber(),
      breakStartMinute: breakRange?.start.toNumber() ?? null,
      breakEndMinute: breakRange?.end.toNumber() ?? null,
      createdAt: DateTimeManager.create(),
      updatedAt: null,
    });
  }

  public rules(validateOptions: ValidateOptionsType = DefaultValidateOptions) {
    return new ProviderAvailabilityRules(this, validateOptions);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Public Update Method
  // ────────────────────────────────────────────────────────────────────────────
  public update(props: UpdateProviderAvailabilityProps): void {
    const start = props.startMinute ?? this.startMinute;
    const end = props.endMinute ?? this.endMinute;

    if (isDefined(start) && isDefined(end)) {
      this._availabilityRange = DayMinuteRange.fromNumbers(start, end);
    }

    const breakStart = props.breakStartMinute ?? this.startMinute;
    const breakEnd = props.breakEndMinute ?? this.endMinute;

    this._breakRange = this.createBreakRange(breakStart, breakEnd);

    this._updatedAt = DateTimeManager.create();
  }

  // ────────────────────────────────────────────────────────────────────────────
  public toPersistence(): IProviderAvailability {
    return {
      id: this.id.value,
      providerId: this.providerId.value,
      dayOfWeek: this.dayOfWeek,
      startMinute: this.startMinute,
      endMinute: this.endMinute,
      breakStartMinute: this.breakStartMinute,
      breakEndMinute: this.breakEndMinute,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Domain Validation & Helper

  private createBreakRange(
    startMinute?: number | null,
    endMinute?: number | null
  ) {
    const breakStartMinute = startMinute ?? this.breakStartMinute;
    const breakEndMinute = endMinute ?? this.breakEndMinute;

    return isDefined(breakStartMinute) && isDefined(breakEndMinute)
      ? DayMinuteRange.fromNumbers(breakStartMinute, breakEndMinute)
      : null;
  }
}
