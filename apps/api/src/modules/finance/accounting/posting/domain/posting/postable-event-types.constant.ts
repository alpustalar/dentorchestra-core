import { FinancialEventTypeSchema } from '@shared';
import { FinancialEventTypeType as FinancialEventType } from '@input-type-schemas/FinancialEventTypeSchema';

const { enum: T } = FinancialEventTypeSchema;

/**
 * Fiş üretimi **beklenen** ekonomik olay tipleri — yani posting kuralı olanlar.
 *
 * Neden ayrı bir liste var: dönem kapanışı "fişlenmemiş olay kaldı mı" diye
 * bakıyor. Kuralı olmayan tipler (`MANUAL_JOURNAL`, `DEPRECIATION`, …) hiçbir zaman
 * fişlenmeyeceği için, kapsam belirtilmezse böyle tek bir olay mali yılın
 * kapanışını **sonsuza kadar** bloke ederdi. Kapanış kapısı yalnız bu listedeki
 * tipleri sayar.
 *
 * Liste ile kural kümesi `PostingRuleRegistry` içinde **açılışta** karşılaştırılır:
 * kural eklenip liste güncellenmezse (kapanış gerçek boşluğu kaçırır) ya da liste
 * kuralsız bir tip taşırsa (kapanış kilitlenir) uygulama sesli hata verir.
 */
export const POSTABLE_FINANCIAL_EVENT_TYPES: readonly FinancialEventType[] = [
  T.SALES_INVOICE_ISSUED,
  T.PURCHASE_INVOICE_RECEIVED,
  T.PAYMENT_RECEIVED,
  T.PAYMENT_REFUNDED,
  T.PAYMENT_MADE,
  T.PAYROLL_ACCRUED,
  T.CASH_SESSION_CLOSED,
  // Sağlayıcı hesap kapaması: 108'de bekleyen kart tahsilatlarının 102'ye
  // geçişi + komisyonun 653'e gider yazılması. Bu tip olmadan 108 hiç kapanmaz.
  T.PROVIDER_SETTLEMENT_RECEIVED,
  T.PLATFORM_BOOKING_SETTLED,
  T.PLATFORM_BOOKING_REFUNDED,
  // Stok hareketleri: tüketim/zayi/sayım açığı (OUT) ve sayım fazlası (IN).
  // Satın alma girişi köprülenmez — borç kaydı alış faturasından gelir.
  T.STOCK_OUT,
  T.STOCK_IN,
];
