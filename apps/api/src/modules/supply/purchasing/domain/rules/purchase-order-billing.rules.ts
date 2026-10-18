import { Decimal } from 'decimal.js';
import { PurchaseOrderBillingStatusType } from '@input-type-schemas/PurchaseOrderBillingStatusSchema';
import { Money } from '@src/domain/value-objects/money.vo';

/**
 * Fatura eşleştirme hesapları — saf fonksiyonlar. Hem entity (yazma tarafı) hem
 * sorgu handler'ı (okuma tarafı) buradan besleniyor: aynı sayıyı iki yerde
 * hesaplamak, ekranda görünen "kalan" ile yazmada uygulanan sınırın sessizce
 * ayrışmasına yol açardı.
 *
 * Girdi tipi gevşek (`toString()` yeten her şey): entity `decimal.js`, okuma
 * modeli Prisma Decimal taşır; ikisini de aynı fonksiyon yutar.
 */
export interface NumericLike {
  toString(): string;
}

export interface BillableLineSnapshot {
  quantityReceived: NumericLike;
  unitPrice: NumericLike;
  vatRate: number;
}

/**
 * Okuma modeli: tutarlar **kuruş ölçeğinde ondalık string**. `number` idi; JSON'a
 * çift hassasiyetli kayan nokta olarak çıkan tutar, istemci tarafında toplanıp
 * karşılaştırıldığında (ör. "sapma sıfır mı") kuruş artıkları üretiyordu. Finans
 * okuma modellerinin tamamı para alanlarını string taşır (bkz. cari defter,
 * banka ekstresi); bu özet tek sapmaydı.
 */
export interface PurchaseOrderMatchSummary {
  /** Sipariş tutarı (KDV dahil). */
  orderedTotal: string;
  /** Teslim alınan malın KDV dahil değeri. */
  receivedValue: string;
  /** Eşleştirilmiş faturaların KDV dahil toplamı. */
  invoicedTotal: string;
  /** Sipariş tutarından faturalanmamış kısım. */
  remainingToInvoice: string;
  /**
   * Teslim ile fatura arasındaki sapma (teslim − fatura). Pozitif: mal geldi
   * faturası gelmedi. Negatif: faturalandı ama mal (henüz) gelmedi.
   */
  receiptVariance: string;
  billingStatus: PurchaseOrderBillingStatusType;
}

const toDecimal = (value: NumericLike): Decimal =>
  new Decimal(value.toString());

/** Teslim alınan miktarların KDV dahil değeri. */
export function calculateReceivedValue(lines: BillableLineSnapshot[]): Decimal {
  const total = lines.reduce((sum, line) => {
    const net = Money.scale(
      toDecimal(line.quantityReceived).mul(toDecimal(line.unitPrice))
    );
    const vat = Money.scale(net.mul(line.vatRate).div(100));
    return sum.plus(net).plus(vat);
  }, new Decimal(0));

  return Money.scale(total);
}

export interface MatchSummaryInput {
  grandTotal: NumericLike;
  invoicedTotal: NumericLike;
  billingStatus: PurchaseOrderBillingStatusType;
  lines: BillableLineSnapshot[];
}

export function buildMatchSummary(
  input: MatchSummaryInput
): PurchaseOrderMatchSummary {
  const orderedTotal = toDecimal(input.grandTotal);
  const invoicedTotal = toDecimal(input.invoicedTotal);
  const receivedValue = calculateReceivedValue(input.lines);
  const remaining = orderedTotal.minus(invoicedTotal);

  return {
    orderedTotal: orderedTotal.toFixed(2),
    receivedValue: receivedValue.toFixed(2),
    invoicedTotal: invoicedTotal.toFixed(2),
    remainingToInvoice: (remaining.isNegative()
      ? new Decimal(0)
      : remaining
    ).toFixed(2),
    receiptVariance: receivedValue.minus(invoicedTotal).toFixed(2),
    billingStatus: input.billingStatus,
  };
}

// ==========================================
// MAL KABUL ↔ FATURA MUTABAKATI (GRNI)
// ==========================================

/**
 * Üçlü eşleştirme (sipariş ↔ teslim ↔ fatura) sapması taşıyan tek sipariş.
 *
 * Tek sipariş ekranındaki özetle **aynı fonksiyondan** üretilir
 * (`buildMatchSummary`): ekranda görünen sapma ile ay sonu tahakkuk listesindeki
 * sapma ayrı hesaplanırsa ikisi sessizce ayrışır.
 */
export interface GoodsReceiptVarianceLine {
  orderId: string;
  supplierId: string;
  orderDate: Date;
  currency: string;
  status: string;
  billingStatus: PurchaseOrderBillingStatusType;
  orderedTotal: string;
  receivedValue: string;
  invoicedTotal: string;
  /** teslim − fatura. Pozitif: mal geldi faturası gelmedi. Negatif: tersi. */
  receiptVariance: string;
}

/**
 * Para birimi başına sapma toplamı.
 *
 * İki yön **netleştirilmez**: pozitif sapma bir **borç tahakkuku** adayıdır
 * (mal elimizde, faturası gelmedi → 150/326 ya da 159 tahakkuku), negatif sapma
 * ise bir **varlık/avans** kalemidir (fatura geldi, mal gelmedi → peşin ödenen
 * sipariş avansı). Netleştirilseydi ikisi birbirini götürür ve ay sonunda hem
 * eksik borç hem eksik avans **görünmez** olurdu — toplam sıfıra yakın çıktığı
 * için de kimse bakmazdı.
 */
export interface GoodsReceiptVarianceCurrencyTotal {
  currency: string;
  /** Pozitif sapmaların toplamı — faturası gelmemiş mal. */
  notInvoicedTotal: string;
  /** Negatif sapmaların toplamı (mutlak değer) — malı gelmemiş fatura. */
  notReceivedTotal: string;
  orderCount: number;
}

/**
 * Mal kabul ↔ fatura mutabakatı. Fark **kendiliğinden hata değildir**: belge
 * gecikmesi normaldir. Rapor bu yüzden otomatik hiçbir fiş atmaz — tahakkuk
 * kararı (159/326) muhasebecinindir (CLAUDE.md finans kuralı 11).
 */
export interface GoodsReceivedNotInvoicedReport {
  clinicId: string;
  asOf: Date;
  lines: GoodsReceiptVarianceLine[];
  totals: GoodsReceiptVarianceCurrencyTotal[];
}

export interface GoodsReceiptVarianceOrderInput {
  id: string;
  supplierId: string;
  orderDate: Date;
  currency: string;
  status: string;
  billingStatus: PurchaseOrderBillingStatusType;
  grandTotal: NumericLike;
  invoicedTotal: NumericLike;
  lines: BillableLineSnapshot[];
}

export interface GoodsReceiptVarianceReportInput {
  clinicId: string;
  asOf: Date;
  orders: GoodsReceiptVarianceOrderInput[];
}

/**
 * Sapması olan siparişleri süzer ve para birimi başına toplar. Sapması sıfır olan
 * sipariş rapora **girmez**: üçlü eşleştirmesi tamamlanmış sipariş mutabakat
 * kalemi değildir ve listeyi okunamaz hale getirir.
 */
export function buildGoodsReceiptVarianceReport(
  input: GoodsReceiptVarianceReportInput
): GoodsReceivedNotInvoicedReport {
  const lines: GoodsReceiptVarianceLine[] = [];

  for (const order of input.orders) {
    const summary = buildMatchSummary({
      grandTotal: order.grandTotal,
      invoicedTotal: order.invoicedTotal,
      billingStatus: order.billingStatus,
      lines: order.lines,
    });

    if (new Decimal(summary.receiptVariance).isZero()) continue;

    lines.push({
      orderId: order.id,
      supplierId: order.supplierId,
      orderDate: order.orderDate,
      currency: order.currency,
      status: order.status,
      billingStatus: order.billingStatus,
      orderedTotal: summary.orderedTotal,
      receivedValue: summary.receivedValue,
      invoicedTotal: summary.invoicedTotal,
      receiptVariance: summary.receiptVariance,
    });
  }

  // Sapması büyük olan önce: ay sonunda bakılacak ilk kalem en büyük farktır.
  lines.sort((a, b) =>
    new Decimal(b.receiptVariance)
      .abs()
      .comparedTo(new Decimal(a.receiptVariance).abs())
  );

  return {
    clinicId: input.clinicId,
    asOf: input.asOf,
    lines,
    totals: sumVarianceByCurrency(lines),
  };
}

function sumVarianceByCurrency(
  lines: GoodsReceiptVarianceLine[]
): GoodsReceiptVarianceCurrencyTotal[] {
  const byCurrency = new Map<
    string,
    { notInvoiced: Decimal; notReceived: Decimal; orderCount: number }
  >();

  for (const line of lines) {
    const bucket = byCurrency.get(line.currency) ?? {
      notInvoiced: new Decimal(0),
      notReceived: new Decimal(0),
      orderCount: 0,
    };

    const variance = new Decimal(line.receiptVariance);
    if (variance.isPositive()) {
      bucket.notInvoiced = bucket.notInvoiced.plus(variance);
    } else {
      bucket.notReceived = bucket.notReceived.plus(variance.abs());
    }
    bucket.orderCount += 1;

    byCurrency.set(line.currency, bucket);
  }

  return [...byCurrency.entries()].map(([currency, bucket]) => ({
    currency,
    notInvoicedTotal: bucket.notInvoiced.toFixed(2),
    notReceivedTotal: bucket.notReceived.toFixed(2),
    orderCount: bucket.orderCount,
  }));
}
