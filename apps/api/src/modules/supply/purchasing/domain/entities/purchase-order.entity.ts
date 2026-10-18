import { Decimal } from 'decimal.js';
import { PurchaseOrder as IPurchaseOrder } from '@model-schema/PurchaseOrderSchema';
import {
  PurchaseOrderStatusSchema,
  PurchaseOrderStatusType as PurchaseOrderStatus,
} from '@input-type-schemas/PurchaseOrderStatusSchema';
import {
  CurrencySchema,
  CurrencyType as Currency,
} from '@input-type-schemas/CurrencySchema';
import { AggregateRoot } from '@common/domain/aggregate-root';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { CreatePurchaseOrderProps } from '@modules/supply/purchasing/domain/contracts';
import {
  PurchaseOrderCancelWithInvoicesException,
  PurchaseOrderEmptyItemsException,
  PurchaseOrderInvalidStateException,
  PurchaseOrderItemNotFoundException,
  PurchaseOrderNotBillableException,
  PurchaseOrderOverInvoicedException,
  PurchaseOrderOverReceiptException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import PurchaseOrderBillingStatusSchema, {
  PurchaseOrderBillingStatusType as PurchaseOrderBillingStatus,
} from '@input-type-schemas/PurchaseOrderBillingStatusSchema';
import { calculateReceivedValue } from '@modules/supply/purchasing/domain/rules/purchase-order-billing.rules';
import { Money } from '@src/domain/value-objects/money.vo';

export interface PurchaseOrderLine {
  id: string;
  productId: string | null;
  description: string;
  quantityOrdered: Decimal;
  quantityReceived: Decimal;
  unitPrice: Decimal;
  vatRate: number;
  lineNet: Decimal;
  lineVat: Decimal;
  lineTotal: Decimal;
}

export interface ReceiptLine {
  itemId: string;
  quantity: number;
}

/**
 * Satın Alma Siparişi (aggregate root). Tedarikçiye gönderilir, mal kabulle
 * kısmen/tamamen teslim alınır. Katalog ürünü satırları teslimde stok girişi tetikler.
 */
export class PurchaseOrder extends AggregateRoot {
  constructor(data: IPurchaseOrder, lines: PurchaseOrderLine[]) {
    super();
    this._id = UUID.fromTrusted(data.id);
    this._clinicId = UUID.fromTrusted(data.clinicId);
    this._organizationId = UUID.fromTrusted(data.organizationId);
    this._supplierId = UUID.fromTrusted(data.supplierId);
    this._purchaseRequestId = data.purchaseRequestId;
    this._status = data.status;
    this._orderDate = data.orderDate;
    this._expectedDate = data.expectedDate;
    this._currency = data.currency;
    this._netTotal = new Decimal(data.netTotal.toString());
    this._vatTotal = new Decimal(data.vatTotal.toString());
    this._grandTotal = new Decimal(data.grandTotal.toString());
    this._invoicedTotal = new Decimal(data.invoicedTotal.toString());
    this._billingStatus = data.billingStatus;
    this._note = data.note;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
    this._lines = lines;
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

  private _purchaseRequestId: string | null;
  get purchaseRequestId(): string | null {
    return this._purchaseRequestId;
  }

  private _status: PurchaseOrderStatus;
  get status(): PurchaseOrderStatus {
    return this._status;
  }

  private _orderDate: Date;
  get orderDate(): Date {
    return this._orderDate;
  }

  private _expectedDate: Date | null;
  get expectedDate(): Date | null {
    return this._expectedDate;
  }

  private _currency: Currency;
  get currency(): Currency {
    return this._currency;
  }

  private _netTotal: Decimal;
  get netTotal(): Decimal {
    return this._netTotal;
  }

  private _vatTotal: Decimal;
  get vatTotal(): Decimal {
    return this._vatTotal;
  }

  private _grandTotal: Decimal;
  get grandTotal(): Decimal {
    return this._grandTotal;
  }

  private _invoicedTotal: Decimal;
  get invoicedTotal(): Decimal {
    return this._invoicedTotal;
  }

  private _billingStatus: PurchaseOrderBillingStatus;
  get billingStatus(): PurchaseOrderBillingStatus {
    return this._billingStatus;
  }

  /**
   * Fiilen teslim alınan malın KDV dahil değeri. Faturalanan tutarla farkı
   * "mal gelmeden faturalandı" / "mal geldi faturası gelmedi" sapmasını gösterir;
   * eşleştirmeyi bloklamaz, raporlanır.
   */
  get receivedValue(): Decimal {
    return calculateReceivedValue(this._lines);
  }

  /** Henüz faturalanmamış sipariş tutarı (negatife düşmez). */
  get remainingToInvoice(): Decimal {
    const remaining = this._grandTotal.minus(this._invoicedTotal);
    return remaining.isNegative() ? new Decimal(0) : remaining;
  }

  private _note: string | null;
  get note(): string | null {
    return this._note;
  }

  private _createdAt: Date;
  get createdAt(): Date {
    return this._createdAt;
  }

  private _updatedAt: Date;
  get updatedAt(): Date {
    return this._updatedAt;
  }

  private _lines: PurchaseOrderLine[];
  get lines(): PurchaseOrderLine[] {
    return this._lines;
  }

  public static create(props: CreatePurchaseOrderProps): PurchaseOrder {
    if (!props.items || props.items.length === 0) {
      throw new PurchaseOrderEmptyItemsException();
    }

    const now = DateTimeManager.create();

    const lines: PurchaseOrderLine[] = props.items.map((item) => {
      const quantity = new Decimal(item.quantity);
      const unitPrice = new Decimal(item.unitPrice);
      const vatRate = item.vatRate ?? 0;
      const lineNet = Money.scale(quantity.mul(unitPrice));
      const lineVat = Money.scale(lineNet.mul(vatRate).div(100));
      const lineTotal = lineNet.plus(lineVat);

      return {
        id: UUID.generate().value,
        productId: item.productId ?? null,
        description: item.description,
        quantityOrdered: quantity,
        quantityReceived: new Decimal(0),
        unitPrice,
        vatRate,
        lineNet,
        lineVat,
        lineTotal,
      };
    });

    const netTotal = lines.reduce((s, l) => s.plus(l.lineNet), new Decimal(0));
    const vatTotal = lines.reduce((s, l) => s.plus(l.lineVat), new Decimal(0));
    const grandTotal = netTotal.plus(vatTotal);

    return new PurchaseOrder(
      {
        id: UUID.createOrGenerate(props.id).value,
        clinicId: UUID.create(props.clinicId).orThrow().value,
        organizationId: UUID.create(props.organizationId).orThrow().value,
        supplierId: UUID.create(props.supplierId).orThrow().value,
        purchaseRequestId: props.purchaseRequestId ?? null,
        status: PurchaseOrderStatusSchema.enum.DRAFT,
        orderDate: props.orderDate ?? now,
        expectedDate: props.expectedDate ?? null,
        currency: props.currency ?? CurrencySchema.enum.TRY,
        netTotal,
        vatTotal,
        grandTotal,
        invoicedTotal: new Decimal(0),
        billingStatus: PurchaseOrderBillingStatusSchema.enum.NOT_BILLED,
        note: props.note ?? null,
        createdAt: now,
        updatedAt: now,
      },
      lines
    );
  }

  public send(): void {
    if (this._status !== PurchaseOrderStatusSchema.enum.DRAFT) {
      throw new PurchaseOrderInvalidStateException(
        'Yalnızca taslak (DRAFT) siparişler gönderilebilir.',
        this._status,
        'send'
      );
    }
    this._status = PurchaseOrderStatusSchema.enum.SENT;
    this._updatedAt = DateTimeManager.create();
  }

  public cancel(): void {
    const cancellable: PurchaseOrderStatus[] = [
      PurchaseOrderStatusSchema.enum.DRAFT,
      PurchaseOrderStatusSchema.enum.SENT,
    ];
    if (!cancellable.includes(this._status)) {
      throw new PurchaseOrderInvalidStateException(
        'Teslim alınmaya başlanmış veya sonuçlanmış sipariş iptal edilemez.',
        this._status,
        'cancel'
      );
    }

    // Fatura eşleştirmesi `SENT` durumunda da yapılabiliyor (peşin/ön fatura
    // meşrudur). Sayacı dolu bir siparişi iptal etmek, iptal edilmiş bir
    // siparişe bağlı borç bırakır: `applyInvoice` artık reddedildiği için sayaç
    // bir daha asla doğru değere getirilemez ve üçlü eşleştirme (sipariş ↔
    // teslim ↔ fatura) o sipariş için kalıcı olarak anlamsızlaşır. Doğru sıra
    // ters yönde: önce fatura eşleştirmesi kaldırılır, sonra sipariş iptal edilir.
    if (!this._invoicedTotal.isZero()) {
      throw new PurchaseOrderCancelWithInvoicesException({
        orderId: this._id.value,
        invoicedTotal: this._invoicedTotal.toFixed(2),
        billingStatus: this._billingStatus,
      });
    }

    this._status = PurchaseOrderStatusSchema.enum.CANCELLED;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Mal kabul — teslim alınan miktarları kalemlere işler ve durumu günceller.
   * Stok girişini handler ReceiveStockCommand ile yapar (bu metod yalnızca sipariş
   * durumunu tutar).
   */
  public receive(receipts: ReceiptLine[]): void {
    const receivable: PurchaseOrderStatus[] = [
      PurchaseOrderStatusSchema.enum.SENT,
      PurchaseOrderStatusSchema.enum.PARTIALLY_RECEIVED,
    ];
    if (!receivable.includes(this._status)) {
      throw new PurchaseOrderInvalidStateException(
        'Yalnızca gönderilmiş veya kısmen teslim alınmış siparişlerde mal kabul yapılabilir.',
        this._status,
        'receive'
      );
    }

    for (const receipt of receipts) {
      const line = this._lines.find((l) => l.id === receipt.itemId);
      if (!line) throw new PurchaseOrderItemNotFoundException(receipt.itemId);

      const attempted = new Decimal(receipt.quantity);
      const newReceived = line.quantityReceived.plus(attempted);
      if (newReceived.greaterThan(line.quantityOrdered)) {
        throw new PurchaseOrderOverReceiptException({
          itemId: line.id,
          ordered: line.quantityOrdered.toNumber(),
          alreadyReceived: line.quantityReceived.toNumber(),
          attempted: attempted.toNumber(),
        });
      }
      line.quantityReceived = newReceived;
    }

    const fullyReceived = this._lines.every((l) =>
      l.quantityReceived.greaterThanOrEqualTo(l.quantityOrdered)
    );
    this._status = fullyReceived
      ? PurchaseOrderStatusSchema.enum.RECEIVED
      : PurchaseOrderStatusSchema.enum.PARTIALLY_RECEIVED;
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Alış faturasını siparişe eşleştirir (matching). Sayaç kümülatiftir: bir
   * siparişe birden çok fatura kesilebilir (kısmi sevkiyat), ama toplamları
   * sipariş tutarını aşamaz — 3'lü eşleştirmenin asıl koruması budur.
   *
   * Teslim alınmamış malın faturalanması ENGELLENMEZ (peşin/ön fatura meşrudur);
   * fark `receivedValue` üzerinden raporlanır.
   */
  public applyInvoice(amount: Decimal): void {
    this.assertBillable();

    const newTotal = this._invoicedTotal.plus(amount);
    if (newTotal.greaterThan(this._grandTotal)) {
      throw new PurchaseOrderOverInvoicedException({
        orderId: this._id.value,
        orderedTotal: this._grandTotal.toNumber(),
        receivedValue: this.receivedValue.toNumber(),
        alreadyInvoiced: this._invoicedTotal.toNumber(),
        attempted: amount.toNumber(),
      });
    }

    this._invoicedTotal = Money.scale(newTotal);
    this.refreshBillingStatus();
    this._updatedAt = DateTimeManager.create();
  }

  /**
   * Eşleştirmeyi geri alır (yanlış siparişe bağlanmış fatura / fatura iptali).
   * Sayaç sıfırın altına düşemez: düşüyorsa sayaç ile faturalar arasında bir
   * tutarsızlık var demektir, sessizce kırpmak yerine hata verilir.
   */
  public revertInvoice(amount: Decimal): void {
    const newTotal = this._invoicedTotal.minus(amount);
    if (newTotal.isNegative()) {
      throw new PurchaseOrderInvalidStateException(
        'Geri alınan fatura tutarı siparişe işlenmiş toplamdan büyük olamaz.',
        this._status,
        'revertInvoice'
      );
    }

    this._invoicedTotal = Money.scale(newTotal);
    this.refreshBillingStatus();
    this._updatedAt = DateTimeManager.create();
  }

  private assertBillable(): void {
    const billable: PurchaseOrderStatus[] = [
      PurchaseOrderStatusSchema.enum.SENT,
      PurchaseOrderStatusSchema.enum.PARTIALLY_RECEIVED,
      PurchaseOrderStatusSchema.enum.RECEIVED,
    ];
    if (!billable.includes(this._status)) {
      throw new PurchaseOrderNotBillableException(this._status);
    }
  }

  private refreshBillingStatus(): void {
    if (this._invoicedTotal.isZero()) {
      this._billingStatus = PurchaseOrderBillingStatusSchema.enum.NOT_BILLED;
      return;
    }
    this._billingStatus = this._invoicedTotal.greaterThanOrEqualTo(
      this._grandTotal
    )
      ? PurchaseOrderBillingStatusSchema.enum.FULLY_BILLED
      : PurchaseOrderBillingStatusSchema.enum.PARTIALLY_BILLED;
  }

  public getLine(itemId: string): PurchaseOrderLine | undefined {
    return this._lines.find((l) => l.id === itemId);
  }

  public toPersistence(): IPurchaseOrder {
    return {
      id: this._id.value,
      clinicId: this._clinicId.value,
      organizationId: this._organizationId.value,
      supplierId: this._supplierId.value,
      purchaseRequestId: this._purchaseRequestId,
      status: this._status,
      orderDate: this._orderDate,
      expectedDate: this._expectedDate,
      currency: this._currency,
      netTotal: this._netTotal,
      vatTotal: this._vatTotal,
      grandTotal: this._grandTotal,
      invoicedTotal: this._invoicedTotal,
      billingStatus: this._billingStatus,
      note: this._note,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    } as IPurchaseOrder;
  }
}
