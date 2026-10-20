import { QueryResponse } from '@shared/common/response/response.interface';

/**
 * Platform defterine **köprüsü kurulmamış** rezervasyon hareketi: para hareket
 * etti (tahsil edildi ya da iade edildi) ama ekonomik olay
 * (`PLATFORM_BOOKING_SETTLED` / `PLATFORM_BOOKING_REFUNDED`) yazılmadı.
 *
 * Olay hiç yazılmadığı için `sweep-unposted-financial-events` bunu **göremez**
 * (o süpürme yazılmış ama fişlenmemiş olayları arar). Eksiklerin görünür olduğu
 * tek yer bu listedir (CLAUDE.md finans kuralı 4).
 */
export interface UnbridgedBookingLedgerView {
  bookingPaymentId: string;
  clinicId: string;
  /** İade / 336 hareketlerinde null: tür iade satırında tutulmaz. */
  bookingType: string | null;
  /**
   * `SETTLED` → eksik olan tahsilat fişi (108/601/320 hiç yazılmadı: komisyon
   * geliri ve tedarikçi borcu kayıt dışı). `REFUNDED` → eksik olan ters kayıt
   * (108 giden parayı, 601 kazanılmamış komisyonu, 320 artık olmayan borcu
   * göstermeye devam ediyor). İkisi zıt yönde yanlış: eksik tahsilat geliri
   * **eksik**, eksik iade geliri **fazla** gösterir.
   */
  kind: UnbridgedBookingLedgerKind;
  /** Eksik olayın idempotency anahtarı — telafi aynı anahtarla yazar. */
  dedupeKey: string;
  /** İlgili yönün tarihi: tahsilatta `paidAt`, iadede iadenin gerçekleştiği an. */
  occurredAt: Date | null;
  /** İade yönlü / 336 hareketlerde dolu: telafi iade satırından yazılır. */
  refundId: string | null;
}

/**
 * `SETTLED` / `REFUNDED`: rezervasyonun kendi tahsilatı ve iptal iadesi.
 * `RETURNABLE_RECEIVED` / `RETURNABLE_REFUNDED`: müşteriye iade edilecek tahsilat (çift
 * çekim, başarısız rezervasyon) — `B 108 / A 336` ve kapanışı `B 336 / A 108`.
 */
export type UnbridgedBookingLedgerKind =
  | 'SETTLED'
  | 'REFUNDED'
  | 'RETURNABLE_RECEIVED'
  | 'RETURNABLE_REFUNDED';

export type FindUnbridgedBookingLedgerEntriesResponse = QueryResponse<
  UnbridgedBookingLedgerView[]
>;
