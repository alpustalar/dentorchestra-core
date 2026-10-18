import { BookingPayment } from '@shared';
import {
  BridgeableBookingLedgerRow,
  FindBridgeableBookingPaymentsFilter,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

export const BOOKING_PAYMENT_QUERY_REPOSITORY = Symbol(
  'IBookingPaymentQueryRepository'
);

export interface IBookingPaymentQueryRepository {
  findById(id: string): Promise<BookingPayment | null>;
  findByStripeSessionId(sessionId: string): Promise<BookingPayment | null>;
  findByIyzicoConversationId(
    conversationId: string
  ): Promise<BookingPayment | null>;
  /**
   * Platform defterine köprülenmesi gereken hareketler. `paginate` kullanılmaz:
   * dönen küme bir liste raporu değil, "eksik olanı bul" kümesinin girdisidir
   * ve pencere zorunlu olduğu için sınırlıdır.
   */
  findBridgeable(
    filter: FindBridgeableBookingPaymentsFilter
  ): Promise<BridgeableBookingLedgerRow[]>;
}
