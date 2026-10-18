import {
  HotelbedsTransferBooking as IHotelbedsTransferBooking,
  HotelbedsTransferBookingStatusSchema,
} from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';
import { HotelbedsTransferBookingStatusType as HotelbedsTransferBookingStatus } from '@input-type-schemas/HotelbedsTransferBookingStatusSchema';
import { Money } from '@src/domain/value-objects/money.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { Decimal } from 'decimal.js';
import {
  CreateTransferBookingProps,
  UpdateTransferHolderProps,
} from '@modules/crm/health-tourism/transfer/domain/contracts/hotelbeds-transfer-booking';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Guard } from '@common/domain/guards';
import { isNotUndefined } from '@common/utils/is-not-undefined';
import { Name } from '@src/domain/value-objects/name.vo';
import { LastName } from '@src/domain/value-objects/last-name.vo';
import { Email } from '@src/domain/value-objects/email.vo';
import { Phone } from '@src/domain/value-objects/phone.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { isDefined } from '@common/utils';
import { HotelbedsTransferBookingRules } from '@modules/crm/health-tourism/transfer/domain/rules/hotelbeds-transfer-booking.rules';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';

export class HotelbedsTransferBooking extends AggregateRoot {
  constructor(data: IHotelbedsTransferBooking) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._reference = data.reference;
    this._clientReference = data.clientReference;
    this._status = data.status;
    this._holderName = Name.fromTrusted(data.holderName);
    this._holderSurname = LastName.fromTrusted(data.holderSurname);
    this._holderEmail = Email.fromTrusted(data.holderEmail);
    this._holderPhone = Phone.fromTrusted(data.holderPhone);
    this._transfers = data.transfers;
    this._totalAmount = Money.create(data.totalAmount, data.currency).orThrow();
    this._remarks = data.remarks;
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.create(data.clinicId).instance ?? null;
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._leadId = data.leadId;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Private Properties & Getters
  // ────────────────────────────────────────────────────────────────────────────
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

  private _status: HotelbedsTransferBookingStatus;
  get status(): HotelbedsTransferBookingStatus {
    return this._status;
  }

  private _holderName: Name;
  get holderName(): Name {
    return this._holderName;
  }

  private _holderSurname: LastName;
  get holderSurname(): LastName {
    return this._holderSurname;
  }

  private _holderEmail: Email;
  get holderEmail(): Email {
    return this._holderEmail;
  }

  private _holderPhone: Phone;
  get holderPhone(): Phone {
    return this._holderPhone;
  }

  private _transfers: JsonValue;
  get transfers(): JsonValue {
    return this._transfers;
  }

  private _totalAmount: Money;
  get totalAmount(): Money {
    return this._totalAmount;
  }

  private _remarks: string | null;
  get remarks(): string | null {
    return this._remarks;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID | null;
  get clinicId(): UUID | null {
    return this._clinicId;
  }

  private _patientId: UUID | null;
  get patientId(): UUID | null {
    return this._patientId;
  }

  private _leadId: string | null;
  get leadId(): string | null {
    return this._leadId;
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

  public static create(
    props: CreateTransferBookingProps
  ): HotelbedsTransferBooking {
    const currencyValue = Currency.create(props.currency).orThrow();

    const amountValue =
      props.totalAmount instanceof Decimal ||
      typeof props.totalAmount === 'number'
        ? Money.create(props.totalAmount, currencyValue.value).orThrow()
        : props.totalAmount;

    // Tutar pozitif olmak ZORUNDA: fiyatı okunamayan bir sağlayıcı yanıtı
    // (`?? 0`) eskiden buradan geçip "bedava rezervasyon" olarak kaydediliyordu.
    // Otel rezervasyonunda aynı kapı zaten vardı; eksik olan buydu.
    amountValue.validate.greaterThanZero.orThrow(
      'Rezervasyon tutarı pozitif olmalıdır.'
    );

    const id = UUID.createOrGenerate(props.id);

    const now = DateTimeManager.create();

    return new HotelbedsTransferBooking({
      id: id.value,
      reference: props.reference,
      clientReference: props.clientReference ?? null,
      status: props.status,
      holderName: Name.create(props.holderName).orThrow().value,
      holderSurname: LastName.create(props.holderSurname).orThrow().value,
      holderEmail: Email.create(props.holderEmail).orThrow().value,
      holderPhone: Phone.create(props.holderPhone).orThrow().value,
      transfers: props.transfers,
      totalAmount: amountValue.value,
      currency: currencyValue.value,
      remarks: props.remarks ?? null,
      organizationId: props.organizationId,
      clinicId: props.clinicId ?? null,
      patientId: props.patientId ?? null,
      leadId: props.leadId ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Rezervasyonu yapan asıl yolcu/sorumlu (Holder) bilgilerini günceller.
   */
  public updateHolderDetails(props: UpdateTransferHolderProps): void {
    this._holderName = Name.create(props.holderName).orThrow();

    if (isDefined(props.holderSurname))
      this._holderSurname = LastName.create(props.holderSurname).orThrow();

    if (isDefined(props.holderEmail))
      this._holderEmail = Email.create(props.holderEmail).orThrow();

    if (isDefined(props.holderPhone))
      this._holderPhone = Phone.create(props.holderPhone).orThrow();

    if (isNotUndefined(props.remarks)) {
      this._remarks = props.remarks;
    }

    this._updatedAt = DateTimeManager.create();
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new HotelbedsTransferBookingRules(this, validateOptions);
  }

  /**
   * Dış servisten (Hotelbeds) gelen senkronizasyonlarda durum ve transfer detaylarını günceller.
   */

  public syncFromProvider(
    status: HotelbedsTransferBookingStatus,
    transfers: JsonValue,
    totalAmount: Money
  ): void {
    this._status = status;
    this._transfers = transfers;
    this._totalAmount = totalAmount;
    this._updatedAt = DateTimeManager.create();
  }

  public cancel(): void {
    this._status = HotelbedsTransferBookingStatusSchema.enum.CANCELLED;
    this._updatedAt = DateTimeManager.create();
  }

  // ────────────────────────────────────────────────────────────────────────────
  public toPersistence(): IHotelbedsTransferBooking {
    return {
      id: this._id.value,
      reference: this._reference,
      clientReference: this._clientReference,
      status: this._status,
      holderName: this._holderName.value,
      holderSurname: this._holderSurname.value,
      holderEmail: this._holderEmail.value,
      holderPhone: this._holderPhone.value,
      transfers: this._transfers,
      totalAmount: this._totalAmount.value,
      currency: this._totalAmount.currency,
      remarks: this._remarks,
      organizationId: this._organizationId.value,
      clinicId: this._clinicId?.value ?? null,
      patientId: this._patientId?.value ?? null,
      leadId: this._leadId,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Mapping to Persistence

  private isCancelled() {
    const is =
      this._status === HotelbedsTransferBookingStatusSchema.enum.CANCELLED;

    return Guard.monitor(
      is,
      is,
      () => new Error('Transfer "iptal edilmiş" durumda değil.')
    );
  }
}
