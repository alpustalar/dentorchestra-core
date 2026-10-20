import { BookingPaymentRefundStatusValue } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment-refund';

export interface ResolveBookingPaymentRefundResponse {
  readonly refundId: string;
  readonly status: BookingPaymentRefundStatusValue;
}
