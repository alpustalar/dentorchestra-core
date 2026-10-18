import { QueryResponse } from '@shared/common/response/response.interface';

/**
 * Başarılı ama **muhasebe köprüsü kurulmamış** POS hareketi: kart çekildi (ya
 * da iade edildi), ekonomik olay (`PAYMENT_RECEIVED` / `PAYMENT_REFUNDED`)
 * yazılmadı. Olay hiç yazılmadığı için `sweep-unposted-financial-events` bunu
 * göremez — eksiklerin tek görünür olduğu yer bu listedir (CLAUDE.md finans
 * kuralı 4).
 */
export interface UnbridgedPosTransactionView {
  posTransactionId: string;
  clinicId: string;
  patientId: string;
  amount: string;
  currency: string;
  completedAt: Date | null;
  /**
   * `SALE` → eksik olan tahsilat olayı; `VOID`/`REFUND` → eksik olan iade olayı.
   * Telafi komutu doğru olayı yazabilmek için bunu okur; liste de "hangi yön"
   * sorusunu cevaplar (eksik tahsilat geliri eksik, eksik iade geliri fazla
   * gösterir — operasyon için zıt aciliyetler).
   */
  kind: string;
  /** Ters kayıtta geri alınan satış; satışlarda null. */
  originalPosTransactionId: string | null;
}

export type FindUnbridgedPosTransactionsResponse = QueryResponse<
  UnbridgedPosTransactionView[]
>;
