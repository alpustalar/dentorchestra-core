import { Decimal } from 'decimal.js';
import { Money } from '@src/domain/value-objects/money.vo';
import { isPurchaseInvoiceStockAccountCode } from '@shared/common/constants';
import type {
  GrniAccrualCandidate,
  InvoicedNotReceivedWarning,
} from '@shared/modules/accounting-period/interfaces';
import { NumericLike } from '@modules/supply/purchasing/domain/rules/purchase-order-billing.rules';

/**
 * Yıl sonu **GRNI tahakkuku** hesabı (goods received, not invoiced) — saf fonksiyon.
 *
 * `purchase-order-billing.rules.ts`'teki GRNI raporu "bugün ne kadar sapma var"ı KDV DAHİL
 * verir ve tarihsiz sayaçlardan beslenir. Tahakkuk için üç şey farklıdır:
 *
 *  1. **Tarih:** "31 Aralık itibarıyla" — teslim, mal kabul günlüğünden (`receivedAt ≤ asOf`);
 *     fatura, fatura tarihinden (`invoiceDate ≤ asOf`). Sayaç bu soruyu cevaplayamaz.
 *  2. **KDV hariç:** KDV, fatura kesildiğinde doğar (191); tahakkuka girmez.
 *  3. **Para birimi:** defter tek fonksiyonel paradadır; yabancı para birimli sipariş tahakkuk
 *     EDİLEMEZ (kur değerlemesi kapsam dışı) — aday olarak listelenir ama `accruable: false`.
 *
 * İki yön netleşmez (§49.1): teslim > fatura → tahakkuk adayı; fatura > teslim → (yalnız STOK
 * faturalarında) bilgi amaçlı uyarı, otomatik fiş yok.
 */

export interface GrniAccrualReceiptLine {
  itemId: string;
  quantity: NumericLike;
  /** Kabul anındaki birim fiyat anlık görüntüsü (günlükten). */
  unitPrice: NumericLike;
}

export interface GrniAccrualReceipt {
  source: 'GOODS_RECEIPT' | 'LEGACY_BACKFILL';
  lines: GrniAccrualReceiptLine[];
}

export interface GrniAccrualInvoice {
  /** Matrah (KDV hariç). */
  netTotal: NumericLike;
  lineAccountCode: string;
}

export interface GrniAccrualOrderInput {
  id: string;
  supplierId: string;
  orderDate: Date;
  currency: string;
  items: { id: string; productId: string | null }[];
  /** `asOf`'a kadar yapılmış kabuller (süzgeç sorguda). */
  receipts: GrniAccrualReceipt[];
  /** `asOf` itibarıyla siparişe bağlı faturalar (süzgeç sorguda). */
  invoices: GrniAccrualInvoice[];
}

export interface GrniAccrualReportInput {
  /** Defterin fonksiyonel para birimi: tahakkuk yalnız bu cinsteki siparişler için yapılabilir. */
  functionalCurrency: string;
  orders: GrniAccrualOrderInput[];
}

export interface GrniAccrualReport {
  candidates: GrniAccrualCandidate[];
  invoicedNotReceived: InvoicedNotReceivedWarning[];
}

const toDecimal = (value: NumericLike): Decimal =>
  new Decimal(value.toString());

export function buildGrniAccrualReport(
  input: GrniAccrualReportInput
): GrniAccrualReport {
  const candidates: GrniAccrualCandidate[] = [];
  const warnings: InvoicedNotReceivedWarning[] = [];

  for (const order of input.orders) {
    const receivedLines = order.receipts.flatMap((receipt) => receipt.lines);

    // Her satır kendi başına kuruşa yuvarlanır (satır = kalem × fiyat); toplam satırların toplamıdır.
    const receivedNet = receivedLines.reduce(
      (sum, line) =>
        sum.plus(
          Money.scale(toDecimal(line.quantity).mul(toDecimal(line.unitPrice)))
        ),
      new Decimal(0)
    );

    const invoicedNet = order.invoices.reduce(
      (sum, invoice) => sum.plus(toDecimal(invoice.netTotal)),
      new Decimal(0)
    );
    const stockInvoicedNet = order.invoices
      .filter((invoice) =>
        isPurchaseInvoiceStockAccountCode(invoice.lineAccountCode)
      )
      .reduce(
        (sum, invoice) => sum.plus(toDecimal(invoice.netTotal)),
        new Decimal(0)
      );

    const variance = receivedNet.minus(invoicedNet);

    if (variance.gt(0)) {
      const receivedItemIds = new Set(receivedLines.map((line) => line.itemId));
      const itemById = new Map(order.items.map((item) => [item.id, item]));
      // Tüm teslim edilen kalemler katalog ürünüyse stoktur (150); serbest kalem varsa
      // hesabı muhasebeci seçer (gider mi, hizmet mi) — makine tahmin etmez.
      const allCatalog = [...receivedItemIds].every(
        (itemId) => itemById.get(itemId)?.productId != null
      );
      const accruable = order.currency === input.functionalCurrency;

      candidates.push({
        orderId: order.id,
        supplierId: order.supplierId,
        orderDate: order.orderDate,
        currency: order.currency,
        receivedNet: receivedNet.toFixed(2),
        invoicedNet: invoicedNet.toFixed(2),
        accrualAmount: variance.toFixed(2),
        accruable,
        notAccruableReason: accruable ? null : 'FOREIGN_CURRENCY',
        suggestedDebitAccountCode: allCatalog ? '150' : null,
        includesLegacyReceipts: order.receipts.some(
          (receipt) =>
            receipt.source === 'LEGACY_BACKFILL' && receipt.lines.length > 0
        ),
      });
    }

    // Fatura > teslim: yalnız STOK faturası için anlamlı (gider faturasında kabul yok).
    if (stockInvoicedNet.gt(receivedNet)) {
      warnings.push({
        orderId: order.id,
        supplierId: order.supplierId,
        currency: order.currency,
        invoicedNet: stockInvoicedNet.toFixed(2),
        receivedNet: receivedNet.toFixed(2),
        difference: stockInvoicedNet.minus(receivedNet).toFixed(2),
      });
    }
  }

  // En büyük fark önce: ay sonunda bakılacak ilk kalem en büyük tahakkuktur.
  candidates.sort((a, b) =>
    new Decimal(b.accrualAmount).comparedTo(new Decimal(a.accrualAmount))
  );
  warnings.sort((a, b) =>
    new Decimal(b.difference).comparedTo(new Decimal(a.difference))
  );

  return { candidates, invoicedNotReceived: warnings };
}
