/** Telafi turunun sonucu — kaç tahsilat köprülendi, hangileri yine başarısız. */
export interface BackfillPosAccountingEventsResponse {
  attempted: number;
  recorded: number;
  failed: { posTransactionId: string; reason: string }[];
}
