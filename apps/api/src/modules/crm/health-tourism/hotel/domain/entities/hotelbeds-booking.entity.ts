import {
  HotelbedsBooking as IHotelbedsBooking,
  HotelbedsBookingStatusSchema,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { HotelbedsBookingStatusType as HotelbedsBookingStatus } from '@input-type-schemas/HotelbedsBookingStatusSchema';
import {
  JsonValueType,
  JsonValueType as JsonValue,
} from '@input-type-schemas/JsonValueSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { LastName } from '@src/domain/value-objects/last-name.vo';
import { Name } from '@src/domain/value-objects/name.vo';
import {
  CancelHotelbedsBookingProps,
  CreateHotelbedsBookingProps,
} from '@modules/crm/health-tourism/hotel/domain/contracts';
import {
  HotelBookingCancelledEvent,
  HotelBookingCreatedEvent,
} from '@modules/crm/health-tourism/hotel/domain/events';
import { HotelbedsBookingInvalidDateRangeException } from '@modules/crm/health-tourism/hotel/domain/exceptions/hotelbeds-booking.exceptions';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { HotelbedsBookingRules } from '@modules/crm/health-tourism/hotel/domain/rules/hotelbeds-booking.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { Guard } from '@common/domain/guards';

export class HotelbedsBooking extends AggregateRoot {
  constructor(data: IHotelbedsBooking) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._reference = data.reference;
    this._clientReference = data.clientReference;
    this._hotelCode = data.hotelCode;
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._leadId = UUID.create(data.leadId).instance ?? null;
    this._checkIn = data.checkIn;
    this._checkOut = data.checkOut;
    this._status = data.status;
    this._totalNet = Money.fromTrusted(data.totalNet, data.currency);
    this._holderName = Name.fromTrusted(data.holderName);
    this._holderSurname = LastName.fromTrusted(data.holderSurname);
    this._rooms = data.rooms;
    this._remarks = data.remarks;
    this._serviceFee =
      Money.create(data.serviceFee, data.currency).instance ?? null;
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _reference: string;
  get reference(): string {
    return this._reference;
  }

  private _clientReference: string | null;
  get clientReference(): string | null {
    return this._clientReference;
  }

  private _hotelCode: string;
  get hotelCode(): string {
    return this._hotelCode;
  }

  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  private _leadId: UUID | null;
  get leadId(): UUID | null {
    return this._leadId;
  }

  private _checkIn: Date;
  get checkIn(): Date {
    return this._checkIn;
  }

  private _checkOut: Date;
  get checkOut(): Date {
    return this._checkOut;
  }

  private _status: HotelbedsBookingStatus;

  get status(): HotelbedsBookingStatus {
    return this._status;
  }

  private _totalNet: Money;

  get totalNet(): Money {
    return this._totalNet;
  }

  private _holderName: Name;

  get holderName(): Name {
    return this._holderName;
  }

  private _holderSurname: LastName;

  get holderSurname(): LastName {
    return this._holderSurname;
  }

  private _rooms: JsonValue;

  get rooms(): JsonValue {
    return this._rooms;
  }

  private _remarks: string | null;

  get remarks(): string | null {
    return this._remarks;
  }

  private _serviceFee: Money | null;

  get serviceFee(): Money | null {
    return this._serviceFee;
  }

  private _organizationId: UUID;

  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;

  get clinicId(): UUID {
    return this._clinicId;
  }

  private _createdAt: Date;

  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public get validate() {
    return {
      status: {
        isCancelled: this.isCancelled(),
      },
    };
  }

  public static create(props: CreateHotelbedsBookingProps): HotelbedsBooking {
    if (!(props.checkOut > props.checkIn)) {
      throw new HotelbedsBookingInvalidDateRangeException(
        props.checkIn,
        props.checkOut
      );
    }

    const currency = Currency.create(props.currency).orThrow();

    const totalNet = Money.create(props.totalNet, currency.value)
      .orThrow()
      .validate.greaterThanZero.orThrow('Tutar pozitif olmalıdır.');

    const serviceFee = props.serviceFee
      ? Money.create(props.serviceFee, currency.value).orThrow().value
      : null;

    const instance = new HotelbedsBooking({
      id: UUID.createOrGenerate(props.id).value,
      reference: props.reference,
      clientReference: props.clientReference ?? null,
      hotelCode: props.hotelCode,

      // Değer varsa UUID formatını doğrula, yoksa null geç
      patientId: props.patientId
        ? UUID.create(props.patientId).orThrow().value
        : null,
      leadId: props.leadId ? UUID.create(props.leadId).orThrow().value : null,

      checkIn: props.checkIn,
      checkOut: props.checkOut,
      status: props.status,
      totalNet: totalNet.value,
      currency: currency.value,
      holderName: props.holderName,
      holderSurname: props.holderSurname,
      rooms: props.rooms as JsonValueType,
      remarks: props.remarks ?? null,
      serviceFee: serviceFee,
      organizationId: props.organizationId,
      clinicId: props.clinicId,
      createdAt: DateTimeManager.create(),
      updatedAt: DateTimeManager.create(),
    });

    instance.addDomainEvent(
      new HotelBookingCreatedEvent({
        bookingId: instance.id.value,
        reference: instance.reference,
        clinicId: instance.clinicId.value,
        organizationId: instance.organizationId.value,
        patientId: instance.patientId?.value ?? null,
        leadId: instance.leadId?.value ?? null,
        totalNet: instance.totalNet.toApiFormat(),
        currency: instance.totalNet.currency,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.HOTEL_BOOKING_CREATED,
        type: LogType.INFO,
        details: `Otel rezervasyonu oluşturuldu: ${instance.reference} (${instance.hotelCode})`,
      })
    );

    return instance;
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new HotelbedsBookingRules(this, validateOptions);
  }

  /**
   * Zaten iptalliyse sessizce çıkar ve **event üretmez** — çağıran taraf
   * (iptal handler'ı) bu yolu idempotent kabul ediyor; ikinci kez event
   * fırlatmak denetim kaydını ve dinleyicileri gereksiz tetiklerdi.
   */
  public cancel(props: CancelHotelbedsBookingProps): void {
    if (this._status === HotelbedsBookingStatusSchema.enum.CANCELLED) {
      return;
    }

    this._status = HotelbedsBookingStatusSchema.enum.CANCELLED;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new HotelBookingCancelledEvent({
        bookingId: this.id.value,
        reference: this.reference,
        clinicId: this.clinicId.value,
        organizationId: this.organizationId.value,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.HOTEL_BOOKING_CANCELLED,
        type: LogType.INFO,
        details: `Otel rezervasyonu iptal edildi: ${this.reference}${props.reason ? ` — ${props.reason}` : ''}`,
      })
    );
  }

  toPersistence(): IHotelbedsBooking {
    return {
      id: this.id.value,
      reference: this.reference,
      clientReference: this.clientReference,
      hotelCode: this.hotelCode,
      patientId: this.patientId?.value ?? null,
      leadId: this.leadId?.value ?? null,
      checkIn: this.checkIn,
      checkOut: this.checkOut,
      status: this.status,

      totalNet: this.totalNet.value,
      currency: this.totalNet.currency,

      holderName: this.holderName.value,
      holderSurname: this.holderSurname.value,
      rooms: this.rooms ?? null,
      remarks: this.remarks,

      serviceFee: this.serviceFee?.value ?? null,

      organizationId: this.organizationId.value,
      clinicId: this.clinicId?.value ?? null,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private isCancelled() {
    const is = this._status === HotelbedsBookingStatusSchema.enum.CANCELLED;

    return Guard.monitor(
      is,
      is,
      () => new Error('Rezervasyon iptal edilmemiş')
    );
  }
}
