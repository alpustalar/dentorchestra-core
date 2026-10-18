import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';

export const BOOKING_PAYMENT_COMMAND_REPOSITORY = Symbol(
  'IBookingPaymentCommandRepository'
);
export interface IBookingPaymentCommandRepository extends IBaseCommandRepository<BookingPayment> {
  /**
   * Ödeme kaydını `FOR UPDATE` kilitleyerek yükler — yalnız aktif transaction içinde.
   *
   * Sağlayıcı webhook'ları tekrar gönderilebilir ve iki ödeme linki (iyzico/Stripe)
   * aynı anda ödenebilir; PENDING→PAID geçişini besleyen okuma kilitsiz yapılırsa
   * iki webhook da "beklemede" görüp ikisi de rezervasyon açar (çift rezervasyon).
   */
  findByIdForUpdate(id: string): Promise<BookingPayment | null>;
  /** Rezervasyon sonucu (dahili booking id) ile bulur — iptal/iade akışı için. */
  findByBookingId(bookingId: string): Promise<BookingPayment | null>;
  /**
   * Rezervasyon id'siyle kilitleyerek yükler — yalnız aktif transaction içinde.
   * İki eşzamanlı iptal isteğinin ikisinin de "BOOKED" görüp mükerrer iade
   * çağırmasını (çift para çıkışı) engeller.
   */
  findByBookingIdForUpdate(bookingId: string): Promise<BookingPayment | null>;
}
