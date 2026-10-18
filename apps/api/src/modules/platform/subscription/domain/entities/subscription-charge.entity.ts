import { SubscriptionCharge as ISubscriptionCharge } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  SubscriptionChargeStatusSchema,
  SubscriptionChargeStatusType as SubscriptionChargeStatus,
} from '@input-type-schemas/SubscriptionChargeStatusSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { ClaimSubscriptionChargeProps } from '@modules/platform/subscription/domain/contracts';
import { SubscriptionChargeNotPendingException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';

/**
 * Platformun abonelikten tahsil ettiği paranın tek kaydı.
 *
 * **Durum makinesi para hareketinin sırasını kodlar:** satır `PENDING` olarak
 * **çekimden önce** açılır (claim) ve sonucu ayrı bir transaction'da yazılır.
 * Bu yüzden `PENDING` kalmış bir satır "çekim başarısız" DEĞİL, **"çekim yapıldı
 * mı bilinmiyor"** demektir — otomatik yeniden denenmez, insan mutabakatı ister.
 * Eski akışta bu satır hiç yoktu: başarılı çekimden sonra transaction geri
 * alınırsa bir sonraki zamanlanmış çalıştırma kartı ikinci kez çekiyordu.
 *
 * `fromTrusted` konvansiyonu: constructor saklanmış veriyi yeniden yargılamaz.
 */
export class SubscriptionCharge extends AggregateRoot {
  constructor(data: ISubscriptionCharge) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._subscriptionId = UUID.fromTrusted(data.subscriptionId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._periodStart = data.periodStart;
    this._periodEnd = data.periodEnd;
    this._amount = Money.fromTrusted(data.amount, data.currency);
    this._paidAmount = data.paidAmount
      ? Money.fromTrusted(data.paidAmount, data.currency)
      : null;
    this._status = data.status;
    this._providerPaymentId = data.providerPaymentId;
    this._conversationId = data.conversationId;
    this._failureReason = data.failureReason;
    this._attempts = data.attempts;
    this._chargedAt = data.chargedAt;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _subscriptionId: UUID;
  get subscriptionId(): UUID {
    return this._subscriptionId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _periodStart: Date;
  get periodStart(): Date {
    return this._periodStart;
  }

  private _periodEnd: Date;
  get periodEnd(): Date {
    return this._periodEnd;
  }

  private _amount: Money;
  get amount(): Money {
    return this._amount;
  }

  private _paidAmount: Money | null;
  get paidAmount(): Money | null {
    return this._paidAmount;
  }

  private _status: SubscriptionChargeStatus;
  get status(): SubscriptionChargeStatus {
    return this._status;
  }

  private _providerPaymentId: string | null;
  get providerPaymentId(): string | null {
    return this._providerPaymentId;
  }

  private _conversationId: string | null;
  get conversationId(): string | null {
    return this._conversationId;
  }

  private _failureReason: string | null;
  get failureReason(): string | null {
    return this._failureReason;
  }

  private _attempts: number;
  get attempts(): number {
    return this._attempts;
  }

  private _chargedAt: Date | null;
  get chargedAt(): Date | null {
    return this._chargedAt;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  get isPending(): boolean {
    return this._status === SubscriptionChargeStatusSchema.enum.PENDING;
  }

  get isSucceeded(): boolean {
    return this._status === SubscriptionChargeStatusSchema.enum.SUCCEEDED;
  }

  get isFailed(): boolean {
    return this._status === SubscriptionChargeStatusSchema.enum.FAILED;
  }

  /**
   * Dönemi tahsil etmek üzere sahiplenir. Satır `PENDING` doğar: kayıt paradan
   * önce gelir, böylece çekim ile commit arasında süreç ölse bile "bu dönem için
   * bir deneme yapıldı" izi kalır.
   */
  public static claim(props: ClaimSubscriptionChargeProps): SubscriptionCharge {
    const now = DateTimeManager.create();
    const amount = Money.create(props.amount, props.currency).orThrow();

    return new SubscriptionCharge({
      id: UUID.createOrGenerate(props.id).value,
      subscriptionId: UUID.create(props.subscriptionId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      periodStart: props.periodStart,
      periodEnd: props.periodEnd,
      amount: amount.value,
      currency: amount.currency,
      paidAmount: null,
      status: SubscriptionChargeStatusSchema.enum.PENDING,
      providerPaymentId: null,
      conversationId: props.conversationId ?? null,
      failureReason: null,
      attempts: 1,
      chargedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * **Zaten gerçekleşmiş** bir tahsilatı deftere yazar (checkout yolu).
   *
   * Neden `claim`'den ayrı: ilk ödemede para, biz haberdar olmadan ÖNCE
   * müşterinin ödeme formunda çekilir — "sahiplen, sonra çek" sırası burada
   * anlamsızdır, satır bir **kayıt**tır, rezervasyon değil. Yenilemede ise
   * tersi: çekimi biz başlatırız, bu yüzden satır `PENDING` doğar.
   */
  public static recordCompleted(
    props: ClaimSubscriptionChargeProps & {
      providerPaymentId: string;
      paidAmount?: string;
    }
  ): SubscriptionCharge {
    const charge = SubscriptionCharge.claim(props);
    charge.markSucceeded(props.providerPaymentId, props.paidAmount);
    return charge;
  }

  /**
   * Sağlayıcı tahsilatı onayladı.
   *
   * `paidAmount` sağlayıcının **fiilen çektiğini bildirdiği** tutardır ve
   * bizim beyanımızdan farklı olabilir (iyzico'da taksitli ödemede
   * `paidPrice > price`). Fark bastırılmaz: kaydedilir ki mutabakatta görünsün.
   */
  public markSucceeded(providerPaymentId: string, paidAmount?: string): void {
    this.assertPending();

    this._status = SubscriptionChargeStatusSchema.enum.SUCCEEDED;
    this._providerPaymentId = providerPaymentId;
    this._paidAmount = paidAmount
      ? Money.fromTrusted(paidAmount, this._amount.currency)
      : null;
    this._failureReason = null;
    this._chargedAt = DateTimeManager.create();
    this._updatedAt = this._chargedAt;
  }

  /** Sağlayıcı tahsilatı reddetti — dönem yeniden denenebilir (`retry`). */
  public markFailed(reason?: string): void {
    this.assertPending();

    this._status = SubscriptionChargeStatusSchema.enum.FAILED;
    this._failureReason = reason ?? null;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Başarısız dönemi yeniden dener. **Aynı satır** üzerinde çalışır: yeni satır
   * açmak dönem başına tekillik kısıtını kırar ve mükerrer çekim kapısını
   * yeniden açardı. `attempts` dunning kararını besler.
   */
  public retry(amount: Money): void {
    if (!this.isFailed) {
      throw new SubscriptionChargeNotPendingException(
        this._id.value,
        this._status
      );
    }

    // Tutar yeniden okunur: iki deneme arasında modül eklenmiş/çıkarılmış olabilir.
    this._amount = amount;
    this._status = SubscriptionChargeStatusSchema.enum.PENDING;
    this._failureReason = null;
    this._attempts += 1;
    this._updatedAt = DateTimeManager.create();
  }

  /** Bizim beyanımız ile sağlayıcının bildirdiği tutar ayrışıyor mu. */
  public hasAmountMismatch(): boolean {
    if (!this._paidAmount) return false;
    return !this._paidAmount.value.equals(this._amount.value);
  }

  public toPersistence(): ISubscriptionCharge {
    return {
      id: this.id.value,
      subscriptionId: this.subscriptionId.value,
      organizationId: this.organizationId.value,
      periodStart: this.periodStart,
      periodEnd: this.periodEnd,
      amount: this.amount.value,
      currency: this.amount.currency,
      paidAmount: this.paidAmount?.value ?? null,
      status: this.status,
      providerPaymentId: this.providerPaymentId,
      conversationId: this.conversationId,
      failureReason: this.failureReason,
      attempts: this.attempts,
      chargedAt: this.chargedAt,
      createdAt: this.createdAt,
      updatedAt: DateTimeManager.create(),
    };
  }

  private assertPending(): void {
    if (!this.isPending) {
      throw new SubscriptionChargeNotPendingException(
        this._id.value,
        this._status
      );
    }
  }
}
