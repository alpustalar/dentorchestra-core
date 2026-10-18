import { Module } from '@nestjs/common';
import { PaymentLinkModule } from '@src/infrastructure/payment/links/payment-link.module';
import { BookingPaymentIyzicoController } from '@modules/crm/health-tourism/booking-payment/presentation/http/controllers/booking-payment-iyzico.controller';
import { StripeWebhookController } from '@modules/crm/health-tourism/booking-payment/presentation/http/controllers/stripe-webhook.controller';
import { BookingPaymentQueryController } from '@modules/crm/health-tourism/booking-payment/presentation/http/controllers/booking-payment.query.controller';
import { BookingPaymentCommandController } from '@modules/crm/health-tourism/booking-payment/presentation/http/controllers/booking-payment.command.controller';
import { BookingPaymentCommandModule } from '@modules/crm/health-tourism/booking-payment/application/commands/command.module';
import { BookingPaymentQueryModule } from '@modules/crm/health-tourism/booking-payment/application/queries/query.module';

@Module({
  imports: [
    PaymentLinkModule,
    BookingPaymentCommandModule,
    BookingPaymentQueryModule,
  ],
  controllers: [
    BookingPaymentIyzicoController,
    StripeWebhookController,
    BookingPaymentQueryController,
    BookingPaymentCommandController,
  ],
})
export class BookingPaymentPresentationModule {}
