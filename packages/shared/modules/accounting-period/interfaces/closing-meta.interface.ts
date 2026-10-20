/**
 * Yıl sonu kapanışının hata `meta` sözleşmeleri — backend exception'ları ve frontend aynı tipi
 * kullanır (iki-uçlu tip güvenliği; local tanım yalnız backend'i tiplerdi).
 */

/** Önceki yıl kapanmadan sonraki yıl kapatılamaz. */
export interface PreviousPeriodNotClosedMeta extends Record<string, unknown> {
  periodId: string;
  year: number;
  /** Kapanması gereken, henüz kapanmamış en eski yıl. */
  blockingYear: number;
}

/** Önizleme ile kapanış arasında dönemin defterine fiş girdi. */
export interface ClosingPreviewStaleMeta extends Record<string, unknown> {
  periodId: string;
  expectedLastEntryNo: string;
  actualLastEntryNo: string;
}

/** GRNI ters kaydının yazılacağı ertesi yıl dönemi yok ya da açık değil. */
export interface ClosingNextPeriodUnavailableMeta extends Record<string, unknown> {
  periodId: string;
  nextYear: number;
  reason: 'MISSING' | 'NOT_OPEN';
}

/** Kapanışın yazacağı hesaplar hesap planında yok (şablon sonradan genişledi). */
export interface ClosingAccountsMissingMeta extends Record<string, unknown> {
  clinicId: string;
  missingCodes: string[];
}

/** Bakiyesi olan 7. sınıf hesabı yansıtma eşlemesinde yok. */
export interface UnmappedCostAccountMeta extends Record<string, unknown> {
  codes: string[];
}

/** Seçilen sipariş 31 Aralık itibarıyla tahakkuk edilemez. */
export interface GrniAccrualNotEligibleMeta extends Record<string, unknown> {
  orderId: string;
  reason: 'NOT_A_CANDIDATE' | 'FOREIGN_CURRENCY';
}
