import { DateTimeManager } from '@common/utils';
import { Subscription as ISubscription, SubStatusSchema } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import {
  SubscriptionActivatedEvent,
  SubscriptionActivatedEventPayload,
  SubscriptionPaymentFailedEvent,
  SubscriptionPaymentFailedEventPayload,
  SubscriptionRenewedEvent,
  SubscriptionRenewedEventPayload,
} from '@modules/platform/subscription/domain/events';
import { SubStatusType as SubStatus } from '@input-type-schemas/SubStatusSchema';
import {
  BillingTargetSchema,
  BillingTargetType as BillingTarget,
} from '@input-type-schemas/BillingTargetSchema';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Guard } from '@common/domain/guards';
import { CreateSubscriptionProps } from '@modules/platform/subscription/domain/contracts';
import { DateRange } from '@src/domain/value-objects/date-range.vo';
import { ValidateOptionsType } from '@shared/common/validate-options/validate-options.type';
import { SubscriptionRules } from '@modules/platform/subscription/domain/rules/subscription.rules';

/** `Subscription.renew` girişi — yeni dönem + son ödeme referansı + audit event gövdesi. */
export interface RenewSubscriptionInput {
  periodStart: Date;
  periodEnd: Date;
  iyzicoPaymentId: string;
  event: Omit<
    SubscriptionRenewedEventPayload,
    | 'subscriptionId'
    | 'organizationId'
    | 'iyzicoPaymentId'
    | 'periodStart'
    | 'periodEnd'
  >;
}

export class Subscription extends AggregateRoot {
  constructor(data: ISubscription) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._billingTarget = data.billingTarget;
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.create(data.clinicId).instance ?? null;
    this._externalId = data.externalId;
    this._providerPaymentId = data.providerPaymentId;
    this._status = data.status;
    this._trialEndsAt = data.trialEndsAt;

    this._currentPeriodDateRange =
      DateRange.create(data.currentPeriodStart, data.currentPeriodEnd)
        .instance ?? null;

    this._cancelAtPeriodEnd = data.cancelAtPeriodEnd;

    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._version = data.version;
  }

  private _version: number;

  /** Optimistic concurrency version'ı — repository update() guard'ında kullanılır. */
  get version(): number {
    return this._version;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _billingTarget: BillingTarget;
  get billingTarget(): BillingTarget {
    return this._billingTarget;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _clinicId: UUID | null;
  get clinicId(): UUID | null {
    return this._clinicId;
  }

  /**
   * Son BAŞARILI tahsilatın sağlayıcı kimliği. **`externalId`'den ayrıdır:**
   * `externalId` callback'in korelasyon anahtarıdır (conversationId) ve
   * ödeme kimliğiyle ezilirse sağlayıcının ikinci bildirimi aboneliği bulamaz.
   * Tahsilat GEÇMİŞİ burada değil `SubscriptionCharge` defterindedir.
   */
  private _providerPaymentId: string | null;
  get providerPaymentId(): string | null {
    return this._providerPaymentId;
  }

  private _externalId: string | null;
  get externalId(): string | null {
    return this._externalId;
  }

  private _status: SubStatus;
  get status(): SubStatus {
    return this._status;
  }

  private _currentPeriodDateRange: DateRange | null;
  get currentPeriodDateRange(): DateRange | null {
    return this._currentPeriodDateRange;
  }

  private _trialEndsAt: Date | null;
  get trialEndsAt(): Date | null {
    return this._trialEndsAt;
  }

  private _currentPeriodStart: Date | null;
  get currentPeriodStart(): Date | null {
    return this.currentPeriodDateRange?.startDate ?? null;
  }

  private _currentPeriodEnd: Date | null;
  get currentPeriodEnd(): Date | null {
    return this.currentPeriodDateRange?.endDate ?? null;
  }

  private _cancelAtPeriodEnd: boolean;
  get cancelAtPeriodEnd(): boolean {
    return this._cancelAtPeriodEnd;
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
        isActive: () => this.isActive,
        isCancelled: () => this.isCanceled,
      },
    };
  }

  // Durum sorguları
  private get isActive() {
    const is = this._status === SubStatusSchema.enum.ACTIVE;
    return Guard.monitor(
      is,
      is,
      () => new Error('Üyelik "aktif" durumda değil')
    );
  }

  private get isCanceled() {
    const is = this._status === SubStatusSchema.enum.CANCELED;
    return Guard.monitor(
      is,
      is,
      () => new Error('Üyelik "iptal" durumda değil')
    );
  }

  private get isPastDue() {
    const is = this._status === SubStatusSchema.enum.PAST_DUE;
    return Guard.monitor(
      is,
      is,
      () => new Error('Üyelik "gecikmiş" durumda değil')
    );
  }

  private get isExpired() {
    const is = this._status === SubStatusSchema.enum.EXPIRED;
    return Guard.monitor(
      is,
      is,
      () => new Error('Üyelik "süresi bitmiş" durumda değil')
    );
  }

  private get isOnTrial() {
    const isTrialActive =
      !!this._trialEndsAt && this._trialEndsAt > DateTimeManager.create();
    return Guard.monitor(
      isTrialActive,
      isTrialActive,
      () => new Error('Deneme süresi bitmiş')
    );
  }

  private get isCancelScheduled() {
    const isCancel = this._cancelAtPeriodEnd && this.isActive.value;
    return Guard.monitor(
      isCancel,
      isCancel,
      () => new Error('Abonelik iptal edilmek üzere zamanlanmamış')
    );
  }

  private get isInCurrentPeriod() {
    const hasValidPeriod =
      !!this._currentPeriodStart && !!this._currentPeriodEnd;

    const isInside =
      hasValidPeriod &&
      DateTimeManager.isBetween({
        target: DateTimeManager.create(),
        start: this._currentPeriodStart!,
        end: this._currentPeriodEnd!,
        inclusivity: '[)', // Başlangıç dahil, bitiş hariç nizamı
      });

    return Guard.monitor(
      isInside,
      isInside,
      () =>
        new Error(
          'Şu anki tarih, aboneliğin aktif fatura dönemi içerisinde değil.'
        )
    );
  }

  public static create(props: CreateSubscriptionProps): Subscription {
    const subId = UUID.createOrGenerate(props.id);
    const orgId = UUID.create(props.organizationId).orThrow();

    // Faturalandırma hedefi CLINIC ise clinicId zorunlu; ORGANIZATION ise yok sayılır (null).
    const isClinicBilled =
      props.billingTarget === BillingTargetSchema.enum.CLINIC;

    if (isClinicBilled && !props.clinicId) {
      throw new Error('CLINIC faturalandırma hedefinde clinicId zorunludur.');
    }
    const clinicId =
      isClinicBilled && props.clinicId
        ? UUID.create(props.clinicId).orThrow()
        : null;

    const now = DateTimeManager.create();

    return new Subscription({
      id: subId.value,
      billingTarget: props.billingTarget,
      organizationId: orgId.value,
      clinicId: clinicId?.value ?? null,
      externalId: props.externalId ?? null,
      providerPaymentId: null,
      status: SubStatusSchema.enum.ACTIVE,
      trialEndsAt: props.trialEndsAt ?? null,
      currentPeriodStart: props.currentPeriodStart ?? null,
      currentPeriodEnd: props.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
      version: 0,
    });
  }

  /** Ödeme sağlayıcısının abonelik/işlem referansını bağlar (subscribe akışında callback için). */
  public linkExternalId(externalId: string): void {
    this._externalId = externalId;
  }

  /** Yenileme: yeni fatura dönemi başlatır, durumu ACTIVE'e çeker (renewal processor). */
  public startNewPeriod(start: Date, end: Date): void {
    this._currentPeriodDateRange = DateRange.create(start, end).orThrow();
    this._status = SubStatusSchema.enum.ACTIVE;
  }

  /** PAST_DUE grace süresi sonrası abonelik süresi biter (expire processor). */
  public expire(): void {
    this._status = SubStatusSchema.enum.EXPIRED;
  }

  /**
   * Yenileme günü geldi mi — ACTIVE ve fatura dönemi bitmiş.
   *
   * Zamanlanmış işler önce aday listesini tarar, sonra her aboneliği kilitleyip
   * bu kuralla YENİDEN doğrular: tarama ile tahsilat arasında geçen sürede başka
   * bir çalıştırma (veya callback) dönemi ilerletmiş olabilir. Doğrulama olmadan
   * kayıtlı karttan ikinci kez çekim yapılır.
   */
  public isDueForRenewal(now: Date): boolean {
    if (!this.isActive.value) return false;
    const periodEnd = this.currentPeriodEnd;
    return !!periodEnd && DateTimeManager.isBefore(periodEnd, now);
  }

  /** Deneme süresi doldu mu — hâlâ ACTIVE ve trialEndsAt geçmiş. */
  public isTrialOver(now: Date): boolean {
    if (!this.isActive.value) return false;
    return (
      !!this._trialEndsAt && DateTimeManager.isBefore(this._trialEndsAt, now)
    );
  }

  /**
   * PAST_DUE ödemesiz geçen grace süresi doldu mu — erişimin kesilebileceği an.
   * Dönem bilgisi yoksa güvenli tarafta kalınır (süre dolmuş sayılır).
   */
  public isGracePeriodOver(now: Date, graceDays: number): boolean {
    if (!this.isPastDue.value) return false;
    const periodEnd = this.currentPeriodEnd;
    if (!periodEnd) return true;
    return DateTimeManager.isBefore(
      DateTimeManager.addDays(periodEnd, graceDays),
      now
    );
  }

  /**
   * Kayıtlı kartla başarılı otomatik tahsilat sonrası yeni fatura dönemi açılır (renewal processor).
   * Durum ACTIVE'e çekilir, externalId son ödeme referansına güncellenir ve yenileme event'i raise edilir.
   */
  public renew(input: RenewSubscriptionInput): void {
    this._currentPeriodDateRange = DateRange.create(
      input.periodStart,
      input.periodEnd
    ).orThrow();
    this._status = SubStatusSchema.enum.ACTIVE;
    this._cancelAtPeriodEnd = false;
    // Korelasyon anahtarı KORUNUR; ödeme kimliği kendi kolonuna yazılır.
    this._providerPaymentId = input.iyzicoPaymentId;
    this._updatedAt = DateTimeManager.create();

    this.addDomainEvent(
      new SubscriptionRenewedEvent({
        ...input.event,
        subscriptionId: this.id.value,
        organizationId: this.organizationId.value,
        iyzicoPaymentId: input.iyzicoPaymentId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      })
    );
  }

  // Durum geçişleri
  public confirmPayment(
    iyzicoPaymentId: string,
    eventPayload: Omit<
      SubscriptionActivatedEventPayload,
      'subscriptionId' | 'organizationId' | 'iyzicoPaymentId'
    >
  ): void {
    this._providerPaymentId = iyzicoPaymentId;
    this._status = SubStatusSchema.enum.ACTIVE;
    this._cancelAtPeriodEnd = false;
    this.addDomainEvent(
      new SubscriptionActivatedEvent({
        ...eventPayload,
        subscriptionId: this.id.value,
        organizationId: this.organizationId.value,
        iyzicoPaymentId,
      })
    );
  }

  public failPayment(
    eventPayload: Omit<
      SubscriptionPaymentFailedEventPayload,
      'subscriptionId' | 'organizationId'
    >
  ): void {
    this._status = SubStatusSchema.enum.PAST_DUE;
    this.addDomainEvent(
      new SubscriptionPaymentFailedEvent({
        ...eventPayload,
        subscriptionId: this.id.value,
        organizationId: this.organizationId.value,
      })
    );
  }

  public rules(validateOptions: ValidateOptionsType) {
    return new SubscriptionRules(this, validateOptions);
  }
  public scheduleCancellation(): void {
    this._cancelAtPeriodEnd = true;
  }

  public undoCancellation(): void {
    this._cancelAtPeriodEnd = false;
  }

  public cancel(): void {
    this._status = SubStatusSchema.enum.CANCELED;
    this._cancelAtPeriodEnd = false;
  }

  public activate(): void {
    if (this.isActive.value) {
      throw new Error('Abonelik zaten aktif.');
    }
    this._status = SubStatusSchema.enum.ACTIVE;
    this._cancelAtPeriodEnd = false;
  }

  toPersistence(): ISubscription {
    return {
      id: this.id.value,
      billingTarget: this.billingTarget,
      organizationId: this.organizationId.value,
      clinicId: this.clinicId?.value ?? null,
      externalId: this.externalId,
      providerPaymentId: this.providerPaymentId,
      status: this.status,
      trialEndsAt: this.trialEndsAt,
      currentPeriodStart: this.currentPeriodStart,
      currentPeriodEnd: this.currentPeriodEnd,
      cancelAtPeriodEnd: this.cancelAtPeriodEnd,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      version: this.version,
    };
  }
}
