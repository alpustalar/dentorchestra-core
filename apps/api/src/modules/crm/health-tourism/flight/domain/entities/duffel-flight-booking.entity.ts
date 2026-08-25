import { Decimal } from 'decimal.js';
import { DuffelFlightBooking as IDuffelFlightBooking } from '@model-schema/DuffelFlightBookingSchema';
import {
  DuffelFlightBookingStatusSchema,
  DuffelFlightBookingStatusType as DuffelFlightBookingStatus,
} from '@input-type-schemas/DuffelFlightBookingStatusSchema';
import {
  DuffelFlightBookingModeSchema,
  DuffelFlightBookingModeType as DuffelFlightBookingMode,
} from '@input-type-schemas/DuffelFlightBookingModeSchema';
import { JsonValueType as JsonValue } from '@input-type-schemas/JsonValueSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { Guard } from '@common/domain/guards';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';
import {
  CancelFlightBookingProps,
  ConfirmFlightBookingProps,
  CreateFlightBookingProps,
} from '@modules/crm/health-tourism/flight/domain/contracts';
import {
  FlightBookingCancelledEvent,
  FlightBookingConfirmedEvent,
  FlightBookingCreatedEvent,
} from '@modules/crm/health-tourism/flight/domain/events/flight-booking.events';
import { FlightBookingInvalidStateException } from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';

/**
 * Uçuş rezervasyonu (aggregate root).
 *
 * Durum makinesi otel/transferden bilinçli olarak daha katıdır: otel kaydı `PENDING`
 * doğup hiçbir zaman `CONFIRMED`'a terfi etmiyordu ve "gerçekten onaylandı mı"
 * bilgisi yalnız `BookingPayment.status`'ta duruyordu. Uçuşta bilet kesimi kaydın
 * kendisinde izlenir:
 *
 *   HELD ──(ödeme)──▶ CONFIRMED ──▶ CANCELLED
 *     │                   │
 *     └──▶ CANCELLED      └──▶ (iptal)
 *     └──▶ FAILED  (ödeme/sipariş hatası)
 *
 * INSTANT yolda kayıt doğrudan CONFIRMED doğar (sipariş zaten ödenmiş açılır).
 */
export class DuffelFlightBooking extends AggregateRoot {
  constructor(data: IDuffelFlightBooking) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._patientId = UUID.create(data.patientId).instance ?? null;
    this._leadId = data.leadId;
    this._duffelOrderId = data.duffelOrderId;
    this._bookingReference = data.bookingReference;
    this._offerId = data.offerId;
    this._mode = data.mode;
    this._status = data.status;
    this._passengers = data.passengers;
    this._slices = data.slices;
    this._totalAmount = Money.create(data.totalAmount, data.currency).orThrow();
    this._holdExpiresAt = data.holdExpiresAt;
    this._failureReason = data.failureReason;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
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

  private _duffelOrderId: string;
  get duffelOrderId(): string {
    return this._duffelOrderId;
  }

  private _bookingReference: string | null;
  get bookingReference(): string | null {
    return this._bookingReference;
  }

  private _offerId: string;
  get offerId(): string {
    return this._offerId;
  }

  private _mode: DuffelFlightBookingMode;
  get mode(): DuffelFlightBookingMode {
    return this._mode;
  }

  private _status: DuffelFlightBookingStatus;
  get status(): DuffelFlightBookingStatus {
    return this._status;
  }

  private _passengers: JsonValue;
  get passengers(): JsonValue {
    return this._passengers;
  }

  private _slices: JsonValue;
  get slices(): JsonValue {
    return this._slices;
  }

  private _totalAmount: Money;
  get totalAmount(): Money {
    return this._totalAmount;
  }

  private _holdExpiresAt: Date | null;
  get holdExpiresAt(): Date | null {
    return this._holdExpiresAt;
  }

  private _failureReason: string | null;
  get failureReason(): string | null {
    return this._failureReason;
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
        isHeld: this.isHeld(),
        isConfirmed: this.isConfirmed(),
        isCancelled: this.isCancelled(),
      },
    };
  }

  /**
   * Tutulan koltuğun ödeme süresi doldu mu? Duffel bu andan sonra yeri serbest
   * bırakır; ödeme denemeden önce kontrol edilir.
   */
  public get isHoldExpired(): boolean {
    if (this._status !== DuffelFlightBookingStatusSchema.enum.HELD)
      return false;
    if (!this._holdExpiresAt) return false;
    return DateTimeManager.isBefore(
      this._holdExpiresAt,
      DateTimeManager.create()
    );
  }

  public static create(props: CreateFlightBookingProps): DuffelFlightBooking {
    const currency = Currency.create(props.currency).orThrow();

    const amount =
      props.totalAmount instanceof Decimal ||
      typeof props.totalAmount === 'number'
        ? Money.create(props.totalAmount, currency.value).orThrow()
        : props.totalAmount;

    const now = DateTimeManager.create();
    const isHold = props.mode === DuffelFlightBookingModeSchema.enum.HOLD;

    const booking = new DuffelFlightBooking({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      patientId: props.patientId
        ? UUID.create(props.patientId).orThrow().value
        : null,
      leadId: props.leadId ?? null,
      duffelOrderId: props.duffelOrderId,
      bookingReference: props.bookingReference ?? null,
      offerId: props.offerId,
      mode: props.mode,
      // Hold yolunda bilet henüz kesilmedi; instant yolda sipariş ödenmiş açılır.
      status: isHold
        ? DuffelFlightBookingStatusSchema.enum.HELD
        : DuffelFlightBookingStatusSchema.enum.CONFIRMED,
      passengers: props.passengers,
      slices: props.slices,
      totalAmount: amount.value,
      currency: currency.value,
      holdExpiresAt: props.holdExpiresAt ?? null,
      failureReason: null,
      createdAt: now,
      updatedAt: now,
    });

    booking.addDomainEvent(
      new FlightBookingCreatedEvent({
        bookingId: booking.id.value,
        duffelOrderId: booking.duffelOrderId,
        clinicId: booking.clinicId.value,
        organizationId: booking.organizationId.value,
        patientId: booking.patientId?.value ?? null,
        leadId: booking.leadId,
        mode: booking.mode,
        totalAmount: booking.totalAmount.value.toString(),
        currency: booking.totalAmount.currency,
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.FLIGHT_BOOKING_CREATED,
        type: LogType.INFO,
        details: `Uçuş rezervasyonu açıldı (${booking.mode}, ${booking.duffelOrderId}).`,
      })
    );

    return booking;
  }

  /**
   * Tutulan koltuk ödendi, bilet kesildi. Yalnız HELD kayıtta çağrılabilir —
   * CONFIRMED bir kaydı yeniden ödemek Duffel'da çift çekim demektir.
   */
  public confirm(props: ConfirmFlightBookingProps): void {
    if (this._status !== DuffelFlightBookingStatusSchema.enum.HELD) {
      throw new FlightBookingInvalidStateException(
        this._id.value,
        this._status,
        DuffelFlightBookingStatusSchema.enum.HELD
      );
    }

    this._status = DuffelFlightBookingStatusSchema.enum.CONFIRMED;
    if (props.bookingReference) this._bookingReference = props.bookingReference;
    this._holdExpiresAt = null;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new FlightBookingConfirmedEvent({
        bookingId: this._id.value,
        duffelOrderId: this._duffelOrderId,
        clinicId: this._clinicId.value,
        organizationId: this._organizationId.value,
        patientId: this._patientId?.value ?? null,
        leadId: this._leadId,
        bookingReference: this._bookingReference,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.FLIGHT_BOOKING_CONFIRMED,
        type: LogType.INFO,
        details: `Uçuş bileti kesildi (PNR: ${this._bookingReference ?? '-'}).`,
      })
    );
  }

  /** İptal idempotenttir: ikinci çağrı sessizce döner, event tekrarlanmaz. */
  public cancel(props: CancelFlightBookingProps): void {
    if (this._status === DuffelFlightBookingStatusSchema.enum.CANCELLED) return;

    this._status = DuffelFlightBookingStatusSchema.enum.CANCELLED;
    this._holdExpiresAt = null;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new FlightBookingCancelledEvent({
        bookingId: this._id.value,
        duffelOrderId: this._duffelOrderId,
        clinicId: this._clinicId.value,
        organizationId: this._organizationId.value,
        patientId: this._patientId?.value ?? null,
        leadId: this._leadId,
        reason: props.reason ?? null,
        actorId: props.actorId,
        source: props.logSource,
        action: LogAction.FLIGHT_BOOKING_CANCELLED,
        type: LogType.INFO,
        details: props.reason
          ? `Uçuş rezervasyonu iptal edildi: ${props.reason}`
          : 'Uçuş rezervasyonu iptal edildi.',
      })
    );
  }

  /** Sipariş/ödeme başarısız — saga iade yoluna girer. */
  public markFailed(reason: string): void {
    this._status = DuffelFlightBookingStatusSchema.enum.FAILED;
    this._failureReason = reason;
    this._updatedAt = DateTimeManager.create();
  }

  public toPersistence(): IDuffelFlightBooking {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      clinicId: this._clinicId.value,
      patientId: this._patientId?.value ?? null,
      leadId: this._leadId,
      duffelOrderId: this._duffelOrderId,
      bookingReference: this._bookingReference,
      offerId: this._offerId,
      mode: this._mode,
      status: this._status,
      passengers: this._passengers,
      slices: this._slices,
      totalAmount: this._totalAmount.value,
      currency: this._totalAmount.currency,
      holdExpiresAt: this._holdExpiresAt,
      failureReason: this._failureReason,
      createdAt: this._createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private isHeld() {
    const is = this._status === DuffelFlightBookingStatusSchema.enum.HELD;
    return Guard.monitor(
      is,
      is,
      () =>
        new FlightBookingInvalidStateException(
          this._id.value,
          this._status,
          DuffelFlightBookingStatusSchema.enum.HELD
        )
    );
  }

  private isConfirmed() {
    const is = this._status === DuffelFlightBookingStatusSchema.enum.CONFIRMED;
    return Guard.monitor(
      is,
      is,
      () =>
        new FlightBookingInvalidStateException(
          this._id.value,
          this._status,
          DuffelFlightBookingStatusSchema.enum.CONFIRMED
        )
    );
  }

  private isCancelled() {
    const is = this._status === DuffelFlightBookingStatusSchema.enum.CANCELLED;
    return Guard.monitor(
      is,
      is,
      () =>
        new FlightBookingInvalidStateException(
          this._id.value,
          this._status,
          DuffelFlightBookingStatusSchema.enum.CANCELLED
        )
    );
  }
}
