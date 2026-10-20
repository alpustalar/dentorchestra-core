import { ProviderException as IProviderException } from '@model-schema/ProviderExceptionSchema';
import {
  ExceptionTypeSchema,
  ExceptionTypeType as ExceptionType,
} from '@input-type-schemas/ExceptionTypeSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { DateRange } from '@src/domain/value-objects/date-range.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CreateProviderExceptionProps } from '@modules/clinical/provider/domain/contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';

export class ProviderException extends AggregateRoot {
  constructor(data: IProviderException) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._type = data.type;
    this._dateRange = DateRange.fromTrusted(data.startTime, data.endTime);
    this._reason = data.reason;
    this._providerId = UUID.fromTrusted(data.providerId);
    this._createdAt = data.createdAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  get startTime(): Date {
    return this._dateRange.startDate;
  }

  get endTime(): Date {
    return this._dateRange.endDate;
  }
  private _type: ExceptionType;
  get type(): ExceptionType {
    return this._type;
  }

  private _dateRange: DateRange;
  get dateRange(): DateRange {
    return this._dateRange;
  }

  private _reason: string | null;
  get reason(): string | null {
    return this._reason;
  }

  private _providerId: UUID;
  get providerId(): UUID {
    return this._providerId;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  public get validate() {
    return {
      type: { isOff: this.isOff, isOn: this.isOn },
    };
  }

  private get isOff() {
    const isOff = this._type === ExceptionTypeSchema.enum.OFF;
    return Guard.monitor(
      isOff,
      isOff,
      () =>
        new Error('Uzman çalışma istisnası "Blokaj (Kapalı)" tipinde değil.')
    );
  }

  private get isOn() {
    const isOn = this._type === ExceptionTypeSchema.enum.ON;
    return Guard.monitor(
      isOn,
      isOn,
      () => new Error('Uzman çalışma istisnası "Ek Mesai"  tipinde değil.')
    );
  }
  public static create(props: CreateProviderExceptionProps): ProviderException {
    const providerId = UUID.create(props.providerId).orThrow();

    const dateRange = DateRange.create(
      props.startTime,
      props.endTime
    ).orThrow();

    const now = DateTimeManager.create();

    return new ProviderException({
      id: UUID.createOrGenerate(props.id).value,
      providerId: providerId.value,
      type: props.type,
      startTime: dateRange.startDate,
      endTime: dateRange.endDate,
      reason: props.reason ?? null,
      createdAt: now,
    });
  }

  public toPersistence(): IProviderException {
    return {
      id: this.id.value,
      type: this.type,
      startTime: this.startTime,
      endTime: this.endTime,
      reason: this.reason,
      providerId: this.providerId.value,
      createdAt: this.createdAt,
    };
  }
}
