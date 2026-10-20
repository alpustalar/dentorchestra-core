import { Module } from '@nestjs/common';
import { BookingPaymentRefundCommandRepository } from './booking-payment-refund.command.repository';
import { BookingPaymentRefundQueryRepository } from './booking-payment-refund.query.repository';
import { BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.query.repository';

@Module({
  providers: [
    {
      provide: BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
      useClass: BookingPaymentRefundCommandRepository,
    },
    {
      provide: BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY,
      useClass: BookingPaymentRefundQueryRepository,
    },
  ],
  exports: [
    BOOKING_PAYMENT_REFUND_COMMAND_REPOSITORY,
    BOOKING_PAYMENT_REFUND_QUERY_REPOSITORY,
  ],
})
export class BookingPaymentRefundRepositoryModule {}
