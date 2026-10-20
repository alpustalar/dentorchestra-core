import {
  BookingPaymentRefund as IBookingPaymentRefund,
  BookingPaymentRefundStatusSchema,
} from '@shared/generated-zod';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  BookingPaymentProviderValue,
  BookingPaymentRefundKindValue,
  BookingPaymentRefundOriginValue,
  BookingPaymentRefundResolutionValue,
  BookingPaymentRefundStatusValue,
  ConfirmByProviderProps,
  MarkUnconfirmedProps,
  RejectByProviderProps,
  RequestBookingPaymentRefundProps,
  ResolveBookingPaymentRefundProps,
} from '../contracts/booking-payment-refund';
import {
  bookingPaymentRefundIdempotencyKey,
  BOOKING_PAYMENT_REFUND_MIN_NOTE_LENGTH,
  BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES,
} from '../constants/booking-payment-refund.constant';
import {
  BookingPaymentRefundCurrencyNotSupportedException,
  BookingPaymentRefundInvalidRefundedAtException,
  BookingPaymentRefundInvalidTransitionException,
  BookingPaymentRefundNotResolvableException,
  BookingPaymentRefundNotRetryableException,
  BookingPaymentRefundSettleConflictException,
} from '../exceptions/booking-payment-refund.exceptions';
import {
  BookingPaymentRefundResolvedEvent,
  BookingPaymentRefundRetriedEvent,
} from '../events/booking-payment-refund.events';

const { PENDING, CONFIRMED, FAILED, UNCONFIRMED } =
  BookingPaymentRefundStatusSchema.enum;

/**
 * Bir tahsilatın müşteriye geri götürülmesi. Sağlayıcı çağrısının sonucu ÜÇ durumludur
 * (oldu / olmadı / bilinmiyor):
 *
 *   (yeni) → PENDING → CONFIRMED          sağlayıcı onayladı
 *                    → FAILED             sağlayıcı reddetti
 *                    → UNCONFIRMED        çağrı düştü / zaman aşımı / sonuç bilinmiyor
 *   UNCONFIRMED | bayat PENDING → CONFIRMED | FAILED   (yalnız ELLE)
 *   FAILED → PENDING (attempt + 1)                      (yalnız ELLE)
 *
 * `UNCONFIRMED` hiçbir zaman otomatik yeniden denenmez: zaman aşımı sağlayıcıda başarı
 * olabilir, yeniden denemek parayı iki kez geri götürür. `CONFIRMED` sondur.
 *
 * Her geçiş kuralı burada (kural 10); settle eden akış hangi girişimi başlattığını
 * bildirir, araya başka akış girdiyse geçiş reddedilir (kural 3).
 */
export class BookingPaymentRefund extends AggregateRoot {
  constructor(data: IBookingPaymentRefund) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._bookingPaymentId = UUID.fromTrusted(data.bookingPaymentId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._kind = data.kind;
    this._origin = data.origin;
    this._provider = data.provider;
    this._chargeProviderRef = data.chargeProviderRef;
    this._amount = Money.fromTrusted(data.amount, data.currency);
    this._status = data.status;
    this._attemptCount = data.attemptCount;
    this._reason = data.reason;
    this._failureReason = data.failureReason;
    this._requestedAt = data.requestedAt;
    this._requestedById = data.requestedById;
    this._providerRefundRef = data.providerRefundRef;
    this._refundedAt = data.refundedAt;
    this._resolution = data.resolution;
    this._resolvedById = data.resolvedById;
    this._resolvedAt = data.resolvedAt;
    this._resolutionNote = data.resolutionNote;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _bookingPaymentId: UUID;
  get bookingPaymentId(): UUID {
    return this._bookingPaymentId;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _kind: BookingPaymentRefundKindValue;
  get kind(): BookingPaymentRefundKindValue {
    return this._kind;
  }

  private _origin: BookingPaymentRefundOriginValue;
  get origin(): BookingPaymentRefundOriginValue {
    return this._origin;
  }

  private _provider: BookingPaymentProviderValue;
  get provider(): BookingPaymentProviderValue {
    return this._provider;
  }

  private _chargeProviderRef: string;
  get chargeProviderRef(): string {
    return this._chargeProviderRef;
  }

  private _amount: Money;
  get amount(): Money {
    return this._amount;
  }

  private _status: BookingPaymentRefundStatusValue;
  get status(): BookingPaymentRefundStatusValue {
    return this._status;
  }

  private _attemptCount: number;
  get attemptCount(): number {
    return this._attemptCount;
  }

  private _reason: string | null;
  get reason(): string | null {
    return this._reason;
  }

  private _failureReason: string | null;
  get failureReason(): string | null {
    return this._failureReason;
  }

  private _requestedAt: Date | null;
  get requestedAt(): Date | null {
    return this._requestedAt;
  }

  private _requestedById: string | null;
  get requestedById(): string | null {
    return this._requestedById;
  }

  private _providerRefundRef: string | null;
  get providerRefundRef(): string | null {
    return this._providerRefundRef;
  }

  private _refundedAt: Date | null;
  get refundedAt(): Date | null {
    return this._refundedAt;
  }

  private _resolution: BookingPaymentRefundResolutionValue | null;
  get resolution(): BookingPaymentRefundResolutionValue | null {
    return this._resolution;
  }

  private _resolvedById: string | null;
  get resolvedById(): string | null {
    return this._resolvedById;
  }

  private _resolvedAt: Date | null;
  get resolvedAt(): Date | null {
    return this._resolvedAt;
  }

  private _resolutionNote: string | null;
  get resolutionNote(): string | null {
    return this._resolutionNote;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Sağlayıcıya iletilen tekrar-güvenli anahtar: iyzico `conversationId`, Stripe
   * `Idempotency-Key`. Saklanmaz, türetilir; operatör panelde bununla arar.
   */
  get idempotencyKey(): string {
    return bookingPaymentRefundIdempotencyKey({
      refundId: this._id.value,
      attempt: this._attemptCount,
    });
  }

  /**
   * Para geri gitmiş OLABİLİR mi? PENDING (uçuşta), UNCONFIRMED (bilinmiyor) ve CONFIRMED
   * (gitti) hepsi iade tavanına sayılır; yalnız FAILED (sağlayıcı reddetti) sayılmaz.
   * Platform itirazı (tur 32) tavanı bu bayrakla hesaplar — uçuştaki iade görünmez kalırsa
   * itiraz + iade tahsilatı aşabilir (kural 17).
   */
  get countsTowardsReturned(): boolean {
    return this._status !== FAILED;
  }

  /** Çağrı takılmış mı? Taze PENDING "uçuşta"dır; yalnız süresi geçen elle çözülebilir. */
  isStalePending(now: Date = DateTimeManager.create()): boolean {
    if (this._status !== PENDING || !this._requestedAt) return false;
    return (
      DateTimeManager.diffInMinutes(now, this._requestedAt) >=
      BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES
    );
  }

  /** İadeyi talep eder. Satır PENDING doğar; sağlayıcı çağrısını talep eden akış yapar. */
  static request(
    props: RequestBookingPaymentRefundProps
  ): BookingPaymentRefund {
    // iyzico yalnız TRY iade eder; DB'de de CHECK var ama kapı en içte değil burada da dursun.
    if (props.provider === 'IYZICO' && props.amount.currency !== 'TRY') {
      throw new BookingPaymentRefundCurrencyNotSupportedException(
        props.provider,
        props.amount.currency
      );
    }

    const now = DateTimeManager.create();
    return new BookingPaymentRefund({
      id: UUID.createOrGenerate(props.id).value,
      bookingPaymentId: UUID.create(props.bookingPaymentId).orThrow().value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      kind: props.kind,
      origin: 'LIVE',
      provider: props.provider,
      chargeProviderRef: props.chargeProviderRef,
      amount: Money.create(props.amount.value, props.amount.currency).orThrow()
        .value,
      currency: props.amount.currency,
      status: PENDING,
      attemptCount: 1,
      reason: props.reason ?? null,
      failureReason: null,
      requestedAt: now,
      requestedById: props.requestedById ?? null,
      providerRefundRef: null,
      refundedAt: null,
      resolution: null,
      resolvedById: null,
      resolvedAt: null,
      resolutionNote: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  // ---- Sağlayıcı sonucu (settle) ------------------------------------------------

  public markConfirmedByProvider(props: ConfirmByProviderProps): void {
    this.assertPendingAttempt(props.attempt);
    const now = DateTimeManager.create();
    this._status = CONFIRMED;
    this._providerRefundRef = props.providerRefundRef;
    this._refundedAt = now;
    this._failureReason = null;
    this._updatedAt = now;
  }

  public markRejectedByProvider(props: RejectByProviderProps): void {
    this.assertPendingAttempt(props.attempt);
    this._status = FAILED;
    this._failureReason = props.failureReason;
    this._updatedAt = DateTimeManager.create();
  }

  /** Çağrı düştü / zaman aşımı: sonuç bilinmiyor. ASLA otomatik yeniden denenmez. */
  public markUnconfirmed(props: MarkUnconfirmedProps): void {
    this.assertPendingAttempt(props.attempt);
    this._status = UNCONFIRMED;
    this._failureReason = props.failureReason;
    this._updatedAt = DateTimeManager.create();
  }

  // ---- Elle karar ---------------------------------------------------------------

  /**
   * Operatör sağlayıcı panelinden doğruladı. Yalnız UNCONFIRMED ya da takılmış PENDING
   * çözülür; taze PENDING'i çözmek sürmekte olan sağlayıcı çağrısıyla yarışırdı.
   */
  public resolve(props: ResolveBookingPaymentRefundProps): void {
    const now = DateTimeManager.create();
    this.assertResolvable(now);
    if (props.note.trim().length < BOOKING_PAYMENT_REFUND_MIN_NOTE_LENGTH) {
      throw new BookingPaymentRefundInvalidTransitionException(
        'resolve (not çok kısa)',
        this._status
      );
    }

    if (props.outcome === 'CONFIRMED') {
      const refundedAt = props.refundedAt;
      if (
        !refundedAt ||
        DateTimeManager.isAfter(refundedAt, now) ||
        (this._requestedAt &&
          DateTimeManager.isBefore(refundedAt, this._requestedAt))
      ) {
        throw new BookingPaymentRefundInvalidRefundedAtException();
      }
      this._status = CONFIRMED;
      this._refundedAt = refundedAt;
      this._providerRefundRef = props.providerRefundRef ?? null;
      this._failureReason = null;
    } else {
      this._status = FAILED;
      this._failureReason = `Operatör doğruladı: iade gerçekleşmedi. ${props.note.trim()}`;
    }

    this._resolution = props.outcome;
    this._resolvedById = props.resolvedById;
    this._resolvedAt = now;
    this._resolutionNote = props.note.trim();
    this._updatedAt = now;

    this.addDomainEvent(
      new BookingPaymentRefundResolvedEvent({
        refundId: this._id.value,
        bookingPaymentId: this._bookingPaymentId.value,
        clinicId: this._clinicId.value,
        outcome: props.outcome,
        resolvedById: props.resolvedById,
        note: this._resolutionNote,
      })
    );
  }

  /**
   * Elle çözülebilir mi? Çağıran, pahalı kapıları (dönem, defter kanıtı) çalıştırmadan ÖNCE
   * sorar: çözülemeyen satır için dönem kapısının bile çağrılmaması gerekir.
   */
  public assertResolvable(now: Date = DateTimeManager.create()): void {
    if (this._status !== UNCONFIRMED && !this.isStalePending(now)) {
      throw new BookingPaymentRefundNotResolvableException(this._status);
    }
  }

  /** Reddedilmiş iadeyi yeni bir girişimle açar (anahtar değişir: `…:${attempt+1}`). */
  public retry(retriedById: string): void {
    if (this._status !== FAILED) {
      throw new BookingPaymentRefundNotRetryableException(this._status);
    }
    const now = DateTimeManager.create();
    this._status = PENDING;
    this._attemptCount += 1;
    this._failureReason = null;
    // Önceki karar damgası geçmiş girişime aittir; yeni girişimin sonucu yeniden damgalanır.
    this._resolution = null;
    this._resolvedById = null;
    this._resolvedAt = null;
    this._resolutionNote = null;
    this._requestedAt = now;
    this._requestedById = retriedById;
    this._updatedAt = now;

    this.addDomainEvent(
      new BookingPaymentRefundRetriedEvent({
        refundId: this._id.value,
        bookingPaymentId: this._bookingPaymentId.value,
        clinicId: this._clinicId.value,
        attempt: this._attemptCount,
        retriedById,
      })
    );
  }

  private assertPendingAttempt(attempt: number): void {
    if (this._status !== PENDING || this._attemptCount !== attempt) {
      throw new BookingPaymentRefundSettleConflictException(
        attempt,
        this._status
      );
    }
  }

  public toPersistence(): IBookingPaymentRefund {
    return {
      id: this._id.value,
      bookingPaymentId: this._bookingPaymentId.value,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      kind: this._kind,
      origin: this._origin,
      provider: this._provider,
      chargeProviderRef: this._chargeProviderRef,
      amount: this._amount.value,
      currency: this._amount.currency,
      status: this._status,
      attemptCount: this._attemptCount,
      reason: this._reason,
      failureReason: this._failureReason,
      requestedAt: this._requestedAt,
      requestedById: this._requestedById,
      providerRefundRef: this._providerRefundRef,
      refundedAt: this._refundedAt,
      resolution: this._resolution,
      resolvedById: this._resolvedById,
      resolvedAt: this._resolvedAt,
      resolutionNote: this._resolutionNote,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
