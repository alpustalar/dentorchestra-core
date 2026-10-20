import { UnbridgedBookingLedgerKind } from '@modules/crm/health-tourism/booking-payment/application/queries/find-unbridged-booking-ledger-entries/find-unbridged-booking-ledger-entries.response';

/**
 * Telafi turunun sonucu. Başarısızlar **gerekçesiyle** döner: bir kısmı
 * yeniden denemeyle çözülür (sağlayıcı/DB hatası), bir kısmı çözülmez
 * (`BookingLedgerNotPostableException` — fişi matematiksel olarak imkânsız
 * kılan hâl, bir muhasebe kararı bekler). İkisini ayırt etmek operatörün işi
 * olduğu için gerekçe metni taşınır.
 */
export interface BackfillBookingLedgerEntriesResponse {
  attempted: number;
  recorded: number;
  failed: Array<{
    bookingPaymentId: string;
    kind: UnbridgedBookingLedgerKind;
    reason: string;
  }>;
}
