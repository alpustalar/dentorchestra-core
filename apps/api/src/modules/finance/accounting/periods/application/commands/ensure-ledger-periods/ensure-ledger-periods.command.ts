/**
 * Defteri olan her klinik için **cari ve gelecek yılın** muhasebe dönemini garanti
 * eder (idempotent). Zamanlanmış iş tarafından çağrılır; aktör SYSTEM'dir.
 *
 * Neden var: dönem yalnız klinik kaydında açılıyordu. Yıl dönümünde dönem
 * bulunmadığı an itibarıyla **her posting** `NoAccountingPeriodForDateException`
 * alır, dinleyici hatayı yutar ve o günün tüm ekonomik olayları fişsiz kalır —
 * klinik tarafında hiçbir hata görünmeden.
 */
export class EnsureLedgerPeriodsCommand {
  readonly __responseType!: EnsureLedgerPeriodsResult;
}

export interface EnsureLedgerPeriodsResult {
  /** Bu çalıştırmada fiilen açılan dönem sayısı. */
  created: number;
  /** Zaten var olduğu için atlanan dönem sayısı. */
  skipped: number;
  /** Açılamayan (hata alan) dönem sayısı — CRITICAL uyarı üretilir. */
  failed: number;
}
