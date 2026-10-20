import type { Decimal } from 'decimal.js';

export const BOOKING_PAYMENT_COLLECTION_SERVICE = Symbol(
  'IBookingPaymentCollectionService'
);

export interface LockAndGetReversibleAmountParams {
  readonly bookingPaymentId: string;
}

/**
 * Platform rezervasyon tahsilatının **kilitli** geri götürülebilir tutarı — kart itirazı kapısı
 * için (CLAUDE.md kural 17: parayı kart sahibine geri götüren her yol aynı satırı kilitler ve aynı
 * kümülatif tavanı paylaşır).
 *
 * Kilit ile okuma TEK metotta: bölünürse sırayı bozmak ya da kilidi atlamak derleyicinin göremediği
 * bir hata olur. Yetki kontrolü çağıran handler'ın işidir.
 */
export interface IBookingPaymentCollectionService {
  /**
   * `booking_payments` satırını `FOR UPDATE` kilitler (yalnız aktif transaction içinde), itiraz
   * edilebilir olduğunu doğrular ve `tahsilat − iade satırları` tutarını (TRY) döner. İade satırı
   * (PENDING / UNCONFIRMED / CONFIRMED) parayı geri götürmüş ya da götürüyor sayılır; yalnız
   * `FAILED` (sağlayıcı reddetti) sayılmaz.
   *
   * @throws BookingPaymentNotFoundException kayıt yok
   * @throws BookingPaymentNotChargeableException tahsil edilmemiş ya da iyzico dışı kanal
   */
  lockAndGetReversibleAmount(
    params: LockAndGetReversibleAmountParams
  ): Promise<Decimal>;
}
