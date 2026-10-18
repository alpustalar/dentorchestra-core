import { PurchaseInvoice as IPurchaseInvoice } from '@model-schema/PurchaseInvoiceSchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { Money } from '@src/domain/value-objects/money.vo';
import { VatRate } from '@src/domain/value-objects/vat-rate.vo';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { Currency } from '@src/domain/value-objects/currency.vo';
import { PurchaseInvoiceStatusSchema } from '@shared';
import { PurchaseInvoiceStatusType } from '@input-type-schemas/PurchaseInvoiceStatusSchema';
import {
  CancelPurchaseInvoiceProps,
  CreatePurchaseInvoiceProps,
} from '@modules/finance/purchase-invoice/domain/contracts/purchase-invoice';
import {
  PurchaseInvoiceAlreadyCancelledException,
  PurchaseInvoiceAlreadyMatchedException,
  PurchaseInvoiceInvalidDateException,
  PurchaseInvoiceInvalidPrecisionException,
  PurchaseInvoiceNotCancellableException,
  PurchaseInvoiceNotMatchableException,
  PurchaseInvoiceNotMatchedException,
  PurchaseInvoiceNotUnmatchableException,
  PurchaseInvoiceUnbalancedTotalsException,
  PurchaseInvoiceVatMismatchException,
} from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import { Decimal } from 'decimal.js';
import {
  PurchaseInvoiceCancelledEvent,
  PurchaseInvoiceRecordedEvent,
} from '@modules/finance/purchase-invoice/domain/events';
import { LogAction, LogType } from '@src/domain/constants/log-action.constant';

/**
 * KDV ↔ oran tutarlılığında kabul edilen yuvarlama payı: 1 kuruş. Matrah 2 haneye
 * yuvarlanmış olduğu için çarpımın son kuruşu kayabilir; daha geniş tolerans
 * gerçek hataları (yanlış oran/matrah) geçirmeye başlar.
 */
/**
 * Beyan edilen KDV ile orandan hesaplanan tutar arasında kabul edilen sapma:
 * **en az 1 kuruş, en fazla matrahın binde 5'i** (= 0,5 oran puanı).
 *
 * İki rejim birlikte gerekiyor. Tedarikçinin belgesi **bizim** satırlarımızı
 * taşımaz (bu model satır tutmaz, tek matrah/KDV üçlüsü kayıtlanır), ama o belge
 * kendi içinde satır bazında yuvarlanmış olabilir: 10 satırlık bir alış faturasında
 * satır KDV'lerinin toplamı `matrah × oran`dan birkaç kuruş sapar. Sabit 1 kuruşluk
 * tavan bu faturanın **hiç kaydedilememesine** yol açıyordu — tedarikçinin gerçek
 * belgesini reddetmek yanlıştır, belge bizim için bir **dış olgudur**.
 *
 * Oransal tavan (binde 5) çok satırlı faturayı kabul eder; kuruş tabanı ise küçük
 * tutarları kurtarır (0,03 TRY @ %20 → KDV 0,01 → ima edilen oran %33, oransal
 * tavan tek başına bunu reddederdi). Kontrolün asıl işi **veri girişi hatasını**
 * yakalamaktır: yasal oranlar {0, 1, 10, 20} olduğu için yanlış oran seçimi en az
 * 1 oran puanı kaydırır ve iki tavanı da aşar.
 */
const VAT_TOLERANCE_FLOOR = new Decimal('0.01');
const VAT_TOLERANCE_RATIO = new Decimal('0.005');

/**
 * Tedarikçiden alınan alış faturası. Satış faturasının kardeşi; dış belge
 * sağlayıcı yoktur — faturayı biz alır kaydederiz. Kayıt sonrası köprü
 * PURCHASE_INVOICE_RECEIVED olayını yazar; posting 150/770 + 191 / 320 fişini üretir.
 */

export class PurchaseInvoice extends AggregateRoot {
  constructor(data: IPurchaseInvoice) {
    super();
    const currency = data.currency;
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._supplierId = UUID.fromTrusted(data.supplierId);
    this._invoiceNumber = data.invoiceNumber;
    this._invoiceDate = data.invoiceDate;
    this._purchaseOrderId = data.purchaseOrderId;
    this._lineAccountCode = data.lineAccountCode;
    this._vatRate = VatRate.fromTrusted(data.vatRate);
    this._netTotal = Money.fromTrusted(data.netTotal, currency);
    this._vatTotal = Money.fromTrusted(data.vatTotal, currency);
    this._grandTotal = Money.fromTrusted(data.grandTotal, currency);
    this._status = data.status;
    this._cancelledAt = data.cancelledAt;
    this._cancelledById = data.cancelledById;
    this._cancelReason = data.cancelReason;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  private _id: UUID;
  get id(): UUID {
    return this._id;
  }

  private _clinicId: UUID;
  get clinicId(): UUID {
    return this._clinicId;
  }

  private _organizationId: UUID;
  get organizationId(): UUID {
    return this._organizationId;
  }

  private _supplierId: UUID;
  get supplierId(): UUID {
    return this._supplierId;
  }

  private _invoiceNumber: string | null;
  get invoiceNumber(): string | null {
    return this._invoiceNumber;
  }

  private _invoiceDate: Date;
  get invoiceDate(): Date {
    return this._invoiceDate;
  }

  private _purchaseOrderId: string | null;
  get purchaseOrderId(): string | null {
    return this._purchaseOrderId;
  }

  get isMatched(): boolean {
    return this._purchaseOrderId !== null;
  }

  private _lineAccountCode: string;
  get lineAccountCode(): string {
    return this._lineAccountCode;
  }

  private _vatRate: VatRate;
  get vatRate(): VatRate {
    return this._vatRate;
  }

  private _netTotal: Money;
  get netTotal(): Money {
    return this._netTotal;
  }

  private _vatTotal: Money;
  get vatTotal(): Money {
    return this._vatTotal;
  }

  private _grandTotal: Money;
  get grandTotal(): Money {
    return this._grandTotal;
  }

  get currency(): CurrencyType {
    return this.grandTotal.currency;
  }

  private _status: PurchaseInvoiceStatusType;
  get status(): PurchaseInvoiceStatusType {
    return this._status;
  }

  private _cancelledAt: Date | null;
  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  private _cancelledById: string | null;
  get cancelledById(): string | null {
    return this._cancelledById;
  }

  private _cancelReason: string | null;
  get cancelReason(): string | null {
    return this._cancelReason;
  }

  get isCancelled(): boolean {
    return this._status === PurchaseInvoiceStatusSchema.enum.CANCELLED;
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
   * Alış faturasının **kendi** değişmez kuralları burada zorlanır — çağıranda
   * değil. Belge dışarıdan gelir ve tutarları kullanıcı girer; entity'yi kullanan
   * her yol (HTTP komutu, içe aktarma, migration script) aynı kapıdan geçmek
   * zorundadır (CLAUDE.md finans kuralı 10).
   *
   * Dört kural:
   * 1. **Kuruş hassasiyeti** — tutarlar en fazla 2 ondalık taşır. Kolonlar
   *    `Decimal(12,2)`; kuruş altı girdi DB'de sessizce yuvarlanır ve bellekte
   *    tutan "net + KDV = genel toplam" dengesi satırda bozulur (fişi dengesiz
   *    bırakır, fiş kalıcı üretilemez).
   * 2. **Denge** — genel toplam = net + KDV. Dengesiz fatura, posting'de
   *    `UnbalancedJournalEntryException` ile patlar; olay yazılmış olduğu için
   *    süpürme onu sonsuza kadar yeniden dener.
   * 3. **KDV ↔ oran tutarlılığı** — beyan edilen KDV, matrah × orana (±1 kuruş
   *    yuvarlama payı) uymalı. Aksi halde 191 indirilecek KDV ve KDV beyanı
   *    yanlış olur; defter dengeli göründüğü için hata sessiz kalır.
   * 4. **Belge tarihi** — gelecek tarihli fatura kabul edilmez (dönem/vergi
   *    beyanı yanlış döneme düşer).
   */
  public static create(props: CreatePurchaseInvoiceProps): PurchaseInvoice {
    const now = DateTimeManager.create();
    const currency = Currency.create(props.currency).orThrow().value;
    const vatRate = VatRate.create(props.vatRate).orThrow();

    const netTotal = this.toLineAmount(props.netTotal, currency, 'netTotal');
    const vatTotal = this.toLineAmount(props.vatTotal, currency, 'vatTotal');
    const grandTotal = this.toLineAmount(
      props.grandTotal,
      currency,
      'grandTotal'
    );

    this.assertBalanced({ netTotal, vatTotal, grandTotal });
    this.assertVatMatchesRate({ netTotal, vatTotal, vatRate });
    this.assertInvoiceDateNotInFuture(props.invoiceDate, now);

    const invoice = new PurchaseInvoice({
      id: UUID.createOrGenerate(props.id).value,
      clinicId: UUID.create(props.clinicId).orThrow().value,
      organizationId: UUID.create(props.organizationId).orThrow().value,
      supplierId: UUID.create(props.supplierId).orThrow().value,
      invoiceNumber: props.invoiceNumber,
      invoiceDate: props.invoiceDate,
      purchaseOrderId: props.purchaseOrderId ?? null,
      lineAccountCode: props.lineAccountCode,
      vatRate: vatRate.value.toNumber(),
      netTotal: netTotal.value,
      vatTotal: vatTotal.value,
      grandTotal: grandTotal.value,
      currency,
      status: PurchaseInvoiceStatusSchema.enum.RECORDED,
      cancelledAt: null,
      cancelledById: null,
      cancelReason: null,
      createdAt: now,
      updatedAt: now,
    });

    invoice.addDomainEvent(
      new PurchaseInvoiceRecordedEvent({
        purchaseInvoiceId: invoice.id.value,
        clinicId: invoice.clinicId.value,
        organizationId: invoice.organizationId.value,
        supplierId: invoice.supplierId.value,
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal.toApiFormat(),
        currency: invoice.currency,
        action: LogAction.PURCHASE_INVOICE_RECORDED,
        type: LogType.INFO,
        source: props.source,
        actorId: props.actorId,
      })
    );

    return invoice;
  }

  /** Satır tutarı: `Money`'ye çevirir ve kuruş hassasiyetini zorlar. */
  private static toLineAmount(
    raw: string | number | Decimal,
    currency: CurrencyType,
    field: string
  ): Money {
    const amount = Money.create(raw, currency).orThrow();

    if (amount.value.decimalPlaces() > Money.PRECISION) {
      throw new PurchaseInvoiceInvalidPrecisionException({
        field,
        value: amount.value.toString(),
        maxDecimals: Money.PRECISION,
      });
    }

    return amount;
  }

  private static assertBalanced(amounts: {
    netTotal: Money;
    vatTotal: Money;
    grandTotal: Money;
  }): void {
    const expected = amounts.netTotal.add(amounts.vatTotal);

    if (!amounts.grandTotal.equals(expected)) {
      throw new PurchaseInvoiceUnbalancedTotalsException({
        netTotal: amounts.netTotal.toApiFormat(),
        vatTotal: amounts.vatTotal.toApiFormat(),
        grandTotal: amounts.grandTotal.toApiFormat(),
        expectedGrandTotal: expected.toApiFormat(),
      });
    }
  }

  /**
   * Beyan edilen KDV, matrah × oranla uyuşmalı (tolerans: bkz. `VAT_TOLERANCE_*`).
   */
  private static assertVatMatchesRate(input: {
    netTotal: Money;
    vatTotal: Money;
    vatRate: VatRate;
  }): void {
    const expected = Money.scale(
      input.netTotal.value.mul(input.vatRate.asMultiplier)
    );

    const diff = input.vatTotal.value.minus(expected).abs();
    const allowed = Decimal.max(
      VAT_TOLERANCE_FLOOR,
      input.netTotal.value.mul(VAT_TOLERANCE_RATIO)
    );

    if (diff.greaterThan(allowed)) {
      throw new PurchaseInvoiceVatMismatchException({
        netTotal: input.netTotal.toApiFormat(),
        vatTotal: input.vatTotal.toApiFormat(),
        vatRate: input.vatRate.value.toNumber(),
        expectedVatTotal: expected.toFixed(Money.PRECISION),
      });
    }
  }

  private static assertInvoiceDateNotInFuture(
    invoiceDate: Date,
    now: Date
  ): void {
    if (DateTimeManager.isAfter(invoiceDate, now)) {
      throw new PurchaseInvoiceInvalidDateException({
        invoiceDate: invoiceDate.toISOString(),
      });
    }
  }

  /**
   * Faturayı bir satın alma siparişine bağlar. Sipariş tarafındaki tutar sayacı
   * `ApplyInvoiceToPurchaseOrderCommand` ile ayrıca güncellenir; burada yalnız bağ
   * kurulur. Zaten bağlıysa yeniden bağlanamaz — önce eşleştirme kaldırılır, aksi
   * halde eski siparişin sayacı şişik kalırdı.
   */
  public matchToOrder(purchaseOrderId: string): void {
    if (this._purchaseOrderId) {
      throw new PurchaseInvoiceAlreadyMatchedException({
        invoiceId: this._id.value,
        purchaseOrderId: this._purchaseOrderId,
      });
    }
    if (this._status === PurchaseInvoiceStatusSchema.enum.CANCELLED) {
      throw new PurchaseInvoiceNotMatchableException(this._status);
    }

    this._purchaseOrderId = UUID.create(purchaseOrderId).orThrow().value;
    this._updatedAt = DateTimeManager.create();
  }

  /** Bağı koparır (yanlış sipariş). Sayaç komut tarafında düşülür. */
  public unmatchFromOrder(): string {
    if (!this._purchaseOrderId) {
      throw new PurchaseInvoiceNotMatchedException(this._id.value);
    }

    // İptal, sayacı ZATEN düşürdü ve bağı iz olarak bıraktı. Burada ikinci kez
    // koparılırsa aynı tutar siparişten tekrar düşülür → sipariş hiç
    // faturalanmamış (hatta negatif) görünür.
    if (this.isCancelled) {
      throw new PurchaseInvoiceNotUnmatchableException({
        invoiceId: this._id.value,
        currentStatus: this._status,
      });
    }

    const previousOrderId = this._purchaseOrderId;
    this._purchaseOrderId = null;
    this._updatedAt = DateTimeManager.create();
    return previousOrderId;
  }

  /**
   * Faturayı iptal eder (storno). Belge yerinde kalır; 320 borcu ve gider/stok
   * kaydının etkisini defterde ters kayıt götürür (CLAUDE.md finans kuralı 8).
   *
   * Sipariş bağı (`purchaseOrderId`) **korunur** — hangi siparişin faturası iptal
   * edildiği izlenebilir kalmalı. Siparişin kümülatif `invoicedTotal` sayacı
   * komut tarafında (`RevertInvoiceFromPurchaseOrderCommand`) düşülür; bu yüzden
   * `unmatchFromOrder` iptal edilmiş faturada artık reddedilir (çift düşüm).
   *
   * İki guard: zaten iptal edilmiş fatura (storno iki kez atılırdı) ve ödemesi
   * yapılmış fatura (tedarikçi carisi ters işarete düşerdi).
   */
  public cancel(props: CancelPurchaseInvoiceProps): void {
    if (this.isCancelled) {
      throw new PurchaseInvoiceAlreadyCancelledException({
        invoiceId: this._id.value,
        cancelledAt: this._cancelledAt?.toISOString() ?? null,
      });
    }

    const isSettled =
      this._status === PurchaseInvoiceStatusSchema.enum.PAID ||
      this._status === PurchaseInvoiceStatusSchema.enum.PARTIALLY_PAID;

    if (isSettled) {
      throw new PurchaseInvoiceNotCancellableException({
        invoiceId: this._id.value,
        currentStatus: this._status,
      });
    }

    const now = DateTimeManager.create();

    this._status = PurchaseInvoiceStatusSchema.enum.CANCELLED;
    this._cancelledAt = now;
    this._cancelledById = props.cancelledById;
    this._cancelReason = props.reason;
    this._updatedAt = now;

    this.addDomainEvent(
      new PurchaseInvoiceCancelledEvent({
        purchaseInvoiceId: this._id.value,
        clinicId: this._clinicId.value,
        organizationId: this._organizationId.value,
        supplierId: this._supplierId.value,
        invoiceNumber: this._invoiceNumber,
        purchaseOrderId: this._purchaseOrderId,
        grandTotal: this._grandTotal.value.toFixed(2),
        currency: this.currency,
        reason: props.reason,
        action: LogAction.PURCHASE_INVOICE_CANCELLED,
        type: LogType.SECURITY,
        source: props.source,
        actorId: props.cancelledById,
      })
    );
  }

  /** Repo'nun upsert'ine geçilen ham kayıt. Decimal alanlar Prisma'ya DecimalJsLike olarak gider. */
  public toPersistence(): IPurchaseInvoice {
    return {
      id: this.id.value,
      clinicId: this.clinicId.value,
      organizationId: this.organizationId.value,
      supplierId: this.supplierId.value,
      invoiceNumber: this.invoiceNumber,
      invoiceDate: this.invoiceDate,
      purchaseOrderId: this.purchaseOrderId,
      lineAccountCode: this.lineAccountCode,
      vatRate: this.vatRate.value.toNumber(),
      netTotal: this.netTotal.value,
      vatTotal: this.vatTotal.value,
      grandTotal: this.grandTotal.value,
      currency: this.currency,
      status: this.status,
      cancelledAt: this.cancelledAt,
      cancelledById: this.cancelledById,
      cancelReason: this.cancelReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
