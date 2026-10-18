import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentLinkModule } from '@src/infrastructure/payment/links/payment-link.module';
import { IyzicoModule } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/iyzico.module';
import { BookingPaymentRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/booking-payment/booking-payment.repository.module';
import { InitiateBookingPaymentHandler } from './initiate-booking-payment/initiate-booking-payment.handler';
import { ConfirmBookingPaymentHandler } from './confirm-booking-payment/confirm-booking-payment.handler';
import { HandleBookingPaymentIyzicoCallbackHandler } from './handle-iyzico-callback/handle-iyzico-callback.handler';
import { RefundBookingPaymentHandler } from './refund-booking-payment/refund-booking-payment.handler';
import { BackfillBookingLedgerEntriesHandler } from './backfill-booking-ledger-entries/backfill-booking-ledger-entries.handler';
import { PostingCommandModule } from '@modules/finance/accounting/posting/application/commands/command.module';
import { BookingPaymentQueryModule } from '@modules/crm/health-tourism/booking-payment/application/queries/query.module';
import { BookingPlatformLedgerService } from './../services/booking-platform-ledger.service';

export const BOOKING_PAYMENT_COMMAND_HANDLERS = [
  InitiateBookingPaymentHandler,
  ConfirmBookingPaymentHandler,
  HandleBookingPaymentIyzicoCallbackHandler,
  RefundBookingPaymentHandler,
  BackfillBookingLedgerEntriesHandler,
];

@Module({
  imports: [
    CqrsModule,
    PaymentLinkModule,
    IyzicoModule,
    BookingPaymentRepositoryModule,
    // Tahsilat platform defterine yazılır; PLATFORM_TENANT_PROVIDER buradan gelir.
    PostingCommandModule,
    // Telafi komutu "eksik kalanlar" sorgusunu bus üzerinden çağırır.
    BookingPaymentQueryModule,
  ],
  providers: [
    ...BOOKING_PAYMENT_COMMAND_HANDLERS,
    BookingPlatformLedgerService,
  ],
  exports: BOOKING_PAYMENT_COMMAND_HANDLERS,
})
export class BookingPaymentCommandModule {}
