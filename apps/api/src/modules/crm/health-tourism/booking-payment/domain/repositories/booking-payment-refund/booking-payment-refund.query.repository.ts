import { BookingPaymentRefund, Pagination } from '@shared';
import { Paginated } from '@common/interfaces/paginated.type';
import {
  FindBridgeableBookingPaymentRefundsFilter,
  FindUnresolvedBookingPaymentRefundsFilter,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';

export const BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY = Symbol(
  'IBookingPaymentRefundQueryRepository'
);

export interface IBookingPaymentRefundQueryRepository {
  /**
   * Kapanmamış iadeler: UNCONFIRMED, FAILED ve takılmış (bayat) PENDING. Operatörün
   * "iyzico panelinde doğrula" listesi; kural 4'ün "eksik kalanlar" sorgusu.
   */
  findUnresolved(params: {
    filter: FindUnresolvedBookingPaymentRefundsFilter;
    pagination: Pagination;
  }): Promise<Paginated<BookingPaymentRefund>>;

  /**
   * Platform defterine köprülenmesi gereken iade hareketleri. `paginate` kullanılmaz: dönen
   * küme bir liste raporu değil "eksik olanı bul" kümesinin girdisidir ve pencere zorunlu
   * olduğu için sınırlıdır (bkz. `IBookingPaymentQueryRepository.findBridgeable`).
   *
   *   - CONFIRMED ve `refundedAt` pencerede → ters kayıt (REFUNDED / 336 kapanışı) borçlu.
   *   - LIVE, iade edilecek tahsilat (çift çekim / başarısız rezervasyon) ve `requestedAt`
   *     pencerede → 336 açılışı borçlu (para onaylanmasa da platform hesabına girdi).
   */
  findBridgeable(
    filter: FindBridgeableBookingPaymentRefundsFilter
  ): Promise<BookingPaymentRefund[]>;
}
