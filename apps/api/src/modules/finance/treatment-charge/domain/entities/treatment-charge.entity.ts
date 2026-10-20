import { Decimal } from 'decimal.js';
import { TreatmentCharge as ITreatmentCharge } from '@shared';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  ApplyDiscountProps,
  CreateTreatmentChargeProps,
  VoidChargeProps,
} from '@modules/finance/treatment-charge/domain/contracts/treatment-charge';
import {
  ChargeInvalidPrecisionException,
  DiscountLimitExceededException,
  InvalidChargeQuantityException,
  InvalidDiscountRateException,
  TreatmentChargeAlreadyVoidedException,
} from '@modules/finance/treatment-charge/domain/exceptions/treatment-charge.exceptions';
import {
  TreatmentChargeAddedEvent,
  TreatmentChargeDiscountUpdatedEvent,
  TreatmentChargeVoidedEvent,
} from '@modules/finance/treatment-charge/domain/events/treatment-charge.events';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';

/**
 * Randevuda yapılan işlemin fiyatlı satırı.
 *
 * **Donmuş fiyat ilkesi:** `listPrice` satır doğarken tedaviden kopyalanır ve bir
 * daha değişmez. Tedaviye sonradan yapılan zam geçmiş satırları etkilemez —
 * aksi hâlde kesilmiş bir faturanın dayanağı geriye dönük değişirdi.
 *
 * **İndirim burada yaşar,** hastanın üstünde değil: aynı hasta bir işlemde
 * indirim alıp diğerinde almayabilir, ve her indirim kimin verdiği/neden
 * verildiğiyle birlikte kayıt altındadır.
 */
export class TreatmentCharge extends AggregateRoot {
  constructor(data: ITreatmentCharge) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._appointmentId = UUID.fromTrusted(data.appointmentId);
    this._patientId = UUID.fromTrusted(data.patientId);
    this._treatmentId = UUID.fromTrusted(data.treatmentId);

    this._description = data.description;
    this._quantity = new Decimal(data.quantity.toString());

    this._listPrice = Money.fromTrusted(
      data.listPrice.toString(),
      data.currency
    );
    this._discountRate = new Decimal(data.discountRate.toString());
    this._discountAmount = Money.fromTrusted(
      data.discountAmount.toString(),
      data.currency
    );
    this._discountReason = data.discountReason;
    this._netAmount = Money.fromTrusted(
      data.netAmount.toString(),
      data.currency
    );
    this._vatRate = VatRate.fromTrusted(data.vatRate);
    this._vatAmount = Money.fromTrusted(
      data.vatAmount.toString(),
      data.currency
    );
    this._grossAmount = Money.fromTrusted(
      data.grossAmount.toString(),
      data.currency
    );

    this._discountApprovedById = data.discountApprovedById;
    this._createdById = data.createdById;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._voidedAt = data.voidedAt;
    this._voidReason = data.voidReason;
    // Aktör kimliği ham string: `User.id` bir Firebase UID'dir (UUID değil).
    this._voidedById = data.voidedById;
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

  private _appointmentId: UUID;
  get appointmentId(): UUID {
    return this._appointmentId;
  }

  private _patientId: UUID;
  get patientId(): UUID {
    return this._patientId;
  }

  private _treatmentId: UUID;
  get treatmentId(): UUID {
    return this._treatmentId;
  }

  private _description: string | null;
  get description(): string | null {
    return this._description;
  }

  private _quantity: Decimal;
  get quantity(): Decimal {
    return this._quantity;
  }

  private _listPrice: Money;
  get listPrice(): Money {
    return this._listPrice;
  }

  private _discountRate: Decimal;
  get discountRate(): Decimal {
    return this._discountRate;
  }

  private _discountAmount: Money;
  get discountAmount(): Money {
    return this._discountAmount;
  }

  private _discountReason: string | null;
  get discountReason(): string | null {
    return this._discountReason;
  }

  private _netAmount: Money;
  get netAmount(): Money {
    return this._netAmount;
  }

  private _vatRate: VatRate;
  get vatRate(): VatRate {
    return this._vatRate;
  }

  private _vatAmount: Money;
  get vatAmount(): Money {
    return this._vatAmount;
  }

  private _grossAmount: Money;
  get grossAmount(): Money {
    return this._grossAmount;
  }

  private _discountApprovedById: string | null;
  get discountApprovedById(): string | null {
    return this._discountApprovedById;
  }

  private _createdById: string | null;
  get createdById(): string | null {
    return this._createdById;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _voidedAt: Date | null;
  get voidedAt(): Date | null {
    return this._voidedAt;
  }

  private _voidReason: string | null;
  get voidReason(): string | null {
    return this._voidReason;
  }

  private _voidedById: string | null;
  get voidedById(): string | null {
    return this._voidedById;
  }

  /** İndirimsiz satır tutarı: liste fiyatı × adet. */
  /**
   * Satırın liste tutarı = birim fiyat × adet, **kuruşa yuvarlanmış**.
   *
   * Kolon olarak saklanmıyor, her okumada hesaplanıyor. Adet kesirli olabildiği
   * için (`Decimal(10,3)`) ham çarpım 2 haneden fazla çıkabiliyordu; indirim ve
   * matrah ise 2 haneye yuvarlanmış olarak saklandığı için özet satırında
   * "liste − indirim = matrah" eşitliği bir kuruş kayıyordu.
   */
  get listTotal(): Money {
    return this._listPrice.multiply(this._quantity).round();
  }

  get isVoided(): boolean {
    return this._voidedAt !== null;
  }

  /**
   * Satırı oluşturur; indirim tavanını doğrular ve tüm parasal alanları hesaplar.
   * Hesap sırası bilinçli: **indirim matraha uygulanır, KDV indirimli tutar
   * üzerinden hesaplanır** — yasal olarak KDV iskonto sonrası bedel üzerinden
   * doğar, önce KDV ekleyip sonra indirim uygulamak matrahı bozar.
   */
  public static create(props: CreateTreatmentChargeProps): TreatmentCharge {
    // Varlığın KENDİ değişmez kuralları (politika değil): adet pozitif ve kuruş
    // hassasiyetinde, indirim oranı 0–100, liste fiyatı iki ondalık. Kapıdaki
    // zod şeması bunları zorluyordu ama entity'de karşılığı yoktu — ikinci bir
    // çağıran (paket atama, içe aktarma) korumasız kalıyordu.
    TreatmentCharge.assertValidQuantity(props.quantity);
    TreatmentCharge.assertValidDiscountRate(props.discountRate);
    TreatmentCharge.assertKurusPrecision(props.listPrice);

    TreatmentCharge.assertDiscountWithinLimit({
      requested: props.discountRate,
      max: props.maxDiscountPercent,
      canExceed: props.canExceedDiscountLimit,
    });

    const now = DateTimeManager.create();
    const currency = props.listPrice.currency;

    const amounts = TreatmentCharge.calculateAmounts({
      listPrice: props.listPrice,
      quantity: props.quantity,
      discountRate: props.discountRate,
      vatRate: props.vatRate,
    });

    const exceedsLimit = props.discountRate.greaterThan(
      props.maxDiscountPercent
    );

    return new TreatmentCharge({
      id: UUID.createOrGenerate(props.id).value,
      organizationId: props.organizationId,
      clinicId: props.clinicId,
      appointmentId: props.appointmentId,
      patientId: props.patientId,
      treatmentId: props.treatmentId,

      description: props.description ?? null,
      quantity: props.quantity,

      listPrice: props.listPrice.value,
      discountRate: props.discountRate,
      discountAmount: amounts.discountAmount.value,
      discountReason: props.discountReason ?? null,
      netAmount: amounts.netAmount.value,
      vatRate: props.vatRate.value.toNumber(),
      vatAmount: amounts.vatAmount.value,
      grossAmount: amounts.grossAmount.value,
      currency,

      // Tavan aşıldıysa onaylayan yöneticinin izi bırakılır.
      discountApprovedById: exceedsLimit ? (props.createdById ?? null) : null,
      createdById: props.createdById ?? null,
      createdAt: now,
      updatedAt: now,
      voidedAt: null,
      voidReason: null,
      voidedById: null,
    });
  }

  /**
   * Satırı oluşturur **ve** denetim olayını raise eder. Olay entity içinde
   * doğar; handler onu tekrar publish etmez (repository `flushEvents` ile
   * yayınlar).
   */
  public static add(props: CreateTreatmentChargeProps): TreatmentCharge {
    const charge = TreatmentCharge.create(props);

    charge.addDomainEvent(
      new TreatmentChargeAddedEvent({
        ...charge.auditTarget(),
        grossAmount: charge._grossAmount.toApiFormat(),
        currency: charge._grossAmount.currency,
        discountRate: charge._discountRate.toFixed(2),
        actorId: props.createdById ?? undefined,
        source: props.logSource ?? LogSource.SYSTEM,
        action: LogAction.TREATMENT_CHARGE_ADDED,
        type: LogType.INFO,
        details: props.discountReason ?? undefined,
      })
    );

    return charge;
  }

  /**
   * İndirimi değiştirir ve tüm tutarları yeniden hesaplar. Liste fiyatı ve KDV
   * oranı dokunulmaz — pazarlık payı yalnız indirimdir.
   */
  public applyDiscount(props: ApplyDiscountProps): void {
    this.assertNotVoided();

    TreatmentCharge.assertValidDiscountRate(props.discountRate);

    TreatmentCharge.assertDiscountWithinLimit({
      requested: props.discountRate,
      max: props.maxDiscountPercent,
      canExceed: props.canExceedDiscountLimit,
    });

    const amounts = TreatmentCharge.calculateAmounts({
      listPrice: this._listPrice,
      quantity: this._quantity,
      discountRate: props.discountRate,
      vatRate: this._vatRate,
    });

    const previousDiscountRate = this._discountRate;
    this._discountRate = props.discountRate;
    this._discountAmount = amounts.discountAmount;
    this._discountReason = props.discountReason ?? null;
    this._netAmount = amounts.netAmount;
    this._vatAmount = amounts.vatAmount;
    this._grossAmount = amounts.grossAmount;

    const exceededLimit = props.discountRate.greaterThan(
      props.maxDiscountPercent
    );

    this._discountApprovedById = exceededLimit ? (props.actorId ?? null) : null;

    this._updatedAt = DateTimeManager.create();

    // İndirim geçmişi satırda tutulmuyor (yalnız güncel oran): "kim ne zaman
    // hangi orana çekti" izi bu olayla kalır.
    this.addDomainEvent(
      new TreatmentChargeDiscountUpdatedEvent({
        ...this.auditTarget(),
        previousDiscountRate: previousDiscountRate.toFixed(2),
        discountRate: this._discountRate.toFixed(2),
        grossAmount: this._grossAmount.toApiFormat(),
        currency: this._grossAmount.currency,
        exceededLimit,
        actorId: props.actorId ?? undefined,
        source: props.logSource ?? LogSource.SYSTEM,
        action: LogAction.TREATMENT_CHARGE_DISCOUNT_UPDATED,
        type: LogType.INFO,
        details: props.discountReason ?? undefined,
      })
    );
  }

  /** Satırı iptal eder. Kayıt silinmez; toplamlara girmez hâle gelir. */
  public void(props: VoidChargeProps): void {
    this.assertNotVoided();

    this._voidedAt = DateTimeManager.create();
    this._voidReason = props.reason;
    // Kalıcı damga: iptali kimin yaptığı kayıtta durur (`voidedAt` tek başına
    // "kim" sorusunu yanıtlamıyordu).
    this._voidedById = props.actorId ?? null;
    this._updatedAt = this._voidedAt;

    this.addDomainEvent(
      new TreatmentChargeVoidedEvent({
        ...this.auditTarget(),
        reason: props.reason,
        grossAmount: this._grossAmount.toApiFormat(),
        currency: this._grossAmount.currency,
        actorId: props.actorId ?? undefined,
        source: props.logSource ?? LogSource.SYSTEM,
        action: LogAction.TREATMENT_CHARGE_VOIDED,
        type: LogType.INFO,
        details: props.reason,
      })
    );
  }

  public toPersistence(): ITreatmentCharge {
    return {
      id: this._id.value,
      organizationId: this._organizationId.value,
      clinicId: this._clinicId.value,
      appointmentId: this._appointmentId.value,
      patientId: this._patientId.value,
      treatmentId: this._treatmentId.value,

      description: this._description,
      quantity: this._quantity,

      listPrice: this._listPrice.value,
      discountRate: this._discountRate,
      discountAmount: this._discountAmount.value,
      discountReason: this._discountReason,
      netAmount: this._netAmount.value,
      vatRate: this._vatRate.value.toNumber(),
      vatAmount: this._vatAmount.value,
      grossAmount: this._grossAmount.value,
      currency: this._listPrice.currency,

      discountApprovedById: this._discountApprovedById,
      createdById: this._createdById,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      voidedAt: this._voidedAt,
      voidReason: this._voidReason,
      voidedById: this._voidedById,
    };
  }

  /** Olay gövdelerinin ortak kimlik alanları. */
  private auditTarget() {
    return {
      chargeId: this._id.value,
      clinicId: this._clinicId.value,
      appointmentId: this._appointmentId.value,
      patientId: this._patientId.value,
      treatmentId: this._treatmentId.value,
    };
  }

  /**
   * Tutar hesabının tek kaynağı. `create` ve `applyDiscount` aynı motoru
   * kullanır ki iki yol arasında sapma oluşmasın.
   */
  private static calculateAmounts(input: CalculateAmountsInput): {
    discountAmount: Money;
    netAmount: Money;
    vatAmount: Money;
    grossAmount: Money;
  } {
    // Yuvarlama SATIR TUTARINDA yapılır; türeyen indirim/matrah bu tutardan
    // hesaplanır ki saklanan değerlerle birebir tutsun.
    const listTotal = input.listPrice.multiply(input.quantity).round();

    const discountValue = Money.scale(
      listTotal.value.mul(input.discountRate).div(100)
    );

    const discountAmount = Money.fromTrusted(
      discountValue,
      input.listPrice.currency
    );

    // Matrah = liste toplamı − indirim (KDV bu tutar üzerinden doğar)
    const netAmount = listTotal.subtract(discountAmount);
    const vatAmount = Money.fromTrusted(
      Money.scale(netAmount.value.mul(input.vatRate.asMultiplier)),
      input.listPrice.currency
    );

    return {
      discountAmount,
      netAmount,
      vatAmount,
      grossAmount: netAmount.add(vatAmount),
    };
  }

  /**
   * İndirim tavanı kuralı. Tavan personel için mutlaktır; yalnız kliniği yöneten
   * aktör (klinik sahibi / şube müdürü) aşabilir.
   */
  private static assertDiscountWithinLimit(input: AssertDiscountInput): void {
    if (input.canExceed) return;
    if (!input.requested.greaterThan(input.max)) return;

    throw new DiscountLimitExceededException({
      requestedRate: input.requested.toNumber(),
      maxAllowedRate: input.max.toNumber(),
      overridableByManager: true,
    });
  }

  /** Adet pozitif ve en çok 3 ondalık (DB `Decimal(10,3)`). */
  private static assertValidQuantity(quantity: Decimal): void {
    if (
      !quantity.isFinite() ||
      quantity.lessThanOrEqualTo(0) ||
      quantity.decimalPlaces() > 3
    ) {
      throw new InvalidChargeQuantityException(quantity.toString());
    }
  }

  /**
   * İndirim oranı 0–100. Tavan kontrolü politikadır (yönetici aşabilir), bu
   * ise invariant: negatif oran matrahı liste tutarının ÜSTÜNE çıkarıyor
   * (sessiz zam), %100 üstü oran ise `Money.subtract` içinde "yetersiz bakiye"
   * hatasına dönüşüyordu.
   */
  private static assertValidDiscountRate(rate: Decimal): void {
    if (!rate.isFinite() || rate.isNegative() || rate.greaterThan(100)) {
      throw new InvalidDiscountRateException(rate.toString());
    }
  }

  private static assertKurusPrecision(listPrice: Money): void {
    if (listPrice.value.decimalPlaces() > Money.PRECISION) {
      throw new ChargeInvalidPrecisionException(listPrice.value.toString());
    }
  }

  private assertNotVoided(): void {
    if (this.isVoided) {
      throw new TreatmentChargeAlreadyVoidedException(this._id.value);
    }
  }
}

interface CalculateAmountsInput {
  listPrice: Money;
  quantity: Decimal;
  discountRate: Decimal;
  vatRate: VatRate;
}

interface AssertDiscountInput {
  requested: Decimal;
  max: Decimal;
  canExceed: boolean;
}
