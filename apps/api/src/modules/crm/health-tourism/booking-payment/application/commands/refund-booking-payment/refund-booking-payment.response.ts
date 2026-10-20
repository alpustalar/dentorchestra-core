import { BookingPaymentRefundStatusValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';

/**
 * İade talebinin sonucu. `SKIPPED`: iade edilecek bir ödeme yok (kayıt yok, BOOKED değil,
 * ödeme referansı yok) — iptal akışı bozulmaz.
 *
 * `status` paranın fiilen döndüğünü SÖYLEMEZ ancak `CONFIRMED` olduğunda söyler: `PENDING`,
 * `UNCONFIRMED` ve `FAILED` iadenin sağlayıcıda tamamlanmadığı (ya da doğrulanmadığı)
 * anlamına gelir ve elle takip gerektirir. Frontend / AI bu yüzden yalnız `CONFIRMED`'ı
 * "iade edildi" diye sunar.
 */
export interface RefundBookingPaymentResponse {
  readonly refundId: string | null;
  readonly status: BookingPaymentRefundStatusValue | 'SKIPPED';
}
