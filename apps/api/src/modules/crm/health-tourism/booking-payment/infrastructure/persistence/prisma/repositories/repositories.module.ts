import { Module } from '@nestjs/common';
import { BookingPaymentRepositoryModule } from '@modules/crm/health-tourism/booking-payment/infrastructure/persistence/prisma/repositories/booking-payment/booking-payment.repository.module';
import { BookingPaymentRefundRepositoryModule } from '@modules/crm/health-tourism/booking-payment/infrastructure/persistence/prisma/repositories/booking-payment-refund/booking-payment-refund.repository.module';

@Module({
  imports: [
    BookingPaymentRepositoryModule,
    BookingPaymentRefundRepositoryModule,
  ],
  exports: [
    BookingPaymentRepositoryModule,
    BookingPaymentRefundRepositoryModule,
  ],
})
export class BookingPaymentRepositoriesModule {}
