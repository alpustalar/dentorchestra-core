/** Telafi turunun sonucu — kaç tahsilat denendi, kaçı faturalandı. */
export interface BackfillMissingInvoicesResponse {
  attempted: number;
  issued: number;
  failed: Array<{ paymentId: string; reason: string }>;
}
