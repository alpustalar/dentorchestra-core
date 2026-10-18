/**
 * `RECORDED` — kayıt yeni yazıldı.
 * `SYNCED` — mevcut kaydın durumu kaynağa hizalandı.
 * `UNCHANGED` — kayıt zaten doğru durumdaydı (idempotent tekrar).
 * `SKIPPED` — taksit tahsil edilmemiş; defterde karşılığı olmamalı.
 */
export type SyncInstallmentLedgerEntryOutcome =
  | 'RECORDED'
  | 'SYNCED'
  | 'UNCHANGED'
  | 'SKIPPED';

export interface SyncInstallmentLedgerEntryResponse {
  outcome: SyncInstallmentLedgerEntryOutcome;
}
