/** Telafi turunun sonucu — kaç kayıt denendi, kaçı yazıldı/hizalandı. */
export interface BackfillLedgerEntriesResponse {
  attempted: number;
  recorded: number;
  synced: number;
  failed: Array<{ installmentId: string; reason: string }>;
}
