import { Module } from '@nestjs/common';
import { BookingPaymentRepositoriesModule } from '@modules/crm/health-tourism/booking-payment/infrastructure/persistence/prisma/repositories/repositories.module';
import { BookingPaymentEventModule } from '@modules/crm/health-tourism/booking-payment/infrastructure/messaging/events/booking-payment-event.module';

const InfrastructureModules = [
  BookingPaymentRepositoriesModule,
  BookingPaymentEventModule,
];
@Module({
  imports: [...InfrastructureModules],
  exports: [...InfrastructureModules],
})
export class BookingPaymentInfrastructureModule {}
