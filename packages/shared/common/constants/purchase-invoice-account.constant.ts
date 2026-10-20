/**
 * Alış faturası satırının **karşı (borç) hesabı** — tek kaynak.
 *
 * Alış faturası `B {lineAccountCode} / B 191 / A 320` fişini üretir. Kod yalnız bir
 * etiket değil, borcun **neye** yazılacağı kararıdır: stok mu (150/153), duran varlık
 * mı (25x/260), gider mi (740.0x/760/770). Eskiden kabul kümesi yoktu —
 * `z.string().min(1)` hem DTO'da hem olay gövdesinde, posting kuralı ise değeri
 * olduğu gibi borca yazıyordu. `102` gönderilirse fiş `B 102 / B 191 / A 320` olurdu:
 * dengeli (Σborç = Σalacak tutar), hiçbir bütünlük kontrolüne yakalanmaz, ama
 * **bankada olmayan para** görünür ve banka mutabakatında kalıcı UNMATCHED üretir.
 *
 * Kabul kümesi bu yüzden tek yerde durur ve her kapı (DTO, olay gövdesi, entity
 * `create`, posting kuralı, yıl sonu GRNI tahakkuku) onu import eder — CLAUDE.md
 * finans kuralı 12. Kapı **kullanım yerinden dar** olabilir ama geniş olamaz.
 *
 * **329 bilerek YOK.** 329 (Diğer Ticari Borçlar) yalnız yıl sonu GRNI tahakkukunun
 * (mal geldi, fatura gelmedi) karşı hesabıdır: faturadan seçilebilseydi tahakkuk
 * hesabına fatura borcu karışır, "329'a yalnız GRNI adımları yazar" değişmezi
 * (`finans:degismezler`) anlamsızlaşırdı. Aynı sebeple banka/kasa/alıcı/satıcı/KDV
 * ve sonuç hesapları da yok; bunu `purchase-invoice-account.constant.spec.ts`
 * şablona karşı zorlar.
 */
export const PURCHASE_INVOICE_LINE_ACCOUNT_CODES = [
  // Stok
  '150', // İlk Madde ve Malzeme
  '153', // Ticari Mallar
  // Duran varlık alımı
  '253', // Tesis, Makine ve Cihazlar
  '254', // Taşıtlar
  '255', // Demirbaşlar
  '260', // Haklar
  // Gider (7/A) — `740` bir başlıktır, postlanamaz; alt hesapları kabul edilir
  '740.01', // Sarf Malzeme Tüketimi
  '740.02', // Dış Laboratuvar
  '740.03', // Hekim Hakedişi
  '740.04', // Sterilizasyon / Atık
  '760', // Pazarlama, Satış ve Dağıtım Giderleri
  '770', // Genel Yönetim Giderleri
] as const;

export type PurchaseInvoiceLineAccountCode =
  (typeof PURCHASE_INVOICE_LINE_ACCOUNT_CODES)[number];

/**
 * Kümenin **stok** alt kümesi. Stok faturasında mal fiziken teslim edilir (mal kabul vardır);
 * gider faturasında kabul kavramı yoktur. Yıl sonu "faturası geldi, malı gelmedi" uyarısı yalnız
 * stok faturaları için anlamlıdır (CLAUDE.md finans kuralı 12: küme bu alt kümenin de kaynağıdır).
 */
export const PURCHASE_INVOICE_STOCK_ACCOUNT_CODES = [
  '150',
  '153',
] as const satisfies readonly PurchaseInvoiceLineAccountCode[];

export function isPurchaseInvoiceStockAccountCode(code: string): boolean {
  return (PURCHASE_INVOICE_STOCK_ACCOUNT_CODES as readonly string[]).includes(
    code
  );
}

/** DTO varsayılanı: serbest gider. Stok/varlık alımını çağıran açıkça belirtir. */
export const DEFAULT_PURCHASE_INVOICE_LINE_ACCOUNT_CODE: PurchaseInvoiceLineAccountCode =
  '770';

/** Çalışma anı type-guard'ı: kuralın ve entity'nin "kabul kümesinde mi" sorusu. */
export function isPurchaseInvoiceLineAccountCode(
  code: string
): code is PurchaseInvoiceLineAccountCode {
  return (PURCHASE_INVOICE_LINE_ACCOUNT_CODES as readonly string[]).includes(
    code
  );
}
