/**
 * Bütün defterlerde fişlenmemiş ekonomik olayları süpürür (zamanlanmış iş).
 *
 * Neden var: `FinancialEventRecordedListener` posting hatasını bilerek yutuyor
 * (olay defteri bozulmasın diye) → CRITICAL uyarı düşüyor ama fiş **kalıcı
 * olarak** atılmamış kalıyor. Elle backfill komutu bunu düzeltebiliyordu; ancak
 * onu tetikleyen tek otomatik kontrol yılda bir kez çalışan dönem kapanışı
 * kapısıydı. Bu iş, boşluğun görülme süresini bir güne indirir.
 *
 * Süpürme kendisi yazma yapmaz: hangi kliniklerde açık olduğunu sorar ve her biri
 * için mevcut backfill komutunu çalıştırır (idempotent — fişlenmiş olay filtreden
 * düşer).
 */
export class SweepUnpostedFinancialEventsCommand {
  readonly __responseType!: SweepUnpostedFinancialEventsResult;

  constructor(
    public readonly payload: {
      /** Taranacak geriye dönük gün sayısı. Verilmezse varsayılan pencere. */
      readonly lookbackDays?: number;
    } = {}
  ) {}
}

export interface SweepUnpostedFinancialEventsResult {
  /** Fişlenmemiş olayı bulunan defter sayısı. */
  clinics: number;
  posted: number;
  skipped: number;
  failed: number;
}
