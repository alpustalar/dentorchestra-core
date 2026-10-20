import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BookingPaymentRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/booking-payment/booking-payment.repository.module';
import { GetBookingPaymentHandler } from './get-booking-payment/get-booking-payment.handler';
import { FindUnbridgedBookingLedgerEntriesHandler } from './find-unbridged-booking-ledger-entries/find-unbridged-booking-ledger-entries.handler';
import { BookingPaymentRefundRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/booking-payment-refund/booking-payment-refund.repository.module';
import { FindUnresolvedBookingPaymentRefundsHandler } from './find-unresolved-booking-payment-refunds/find-unresolved-booking-payment-refunds.handler';
import { PostingCommandModule } from '@modules/finance/accounting/posting/application/commands/command.module';

export const BOOKING_PAYMENT_QUERY_HANDLERS = [
  GetBookingPaymentHandler,
  FindUnbridgedBookingLedgerEntriesHandler,
  FindUnresolvedBookingPaymentRefundsHandler,
];

@Module({
  imports: [
    CqrsModule,
    BookingPaymentRepositoryModule,
    BookingPaymentRefundRepositoryModule,
    // Eksik fiş raporu PLATFORM defterine bakar; kiracı hedefi buradan gelir.
    PostingCommandModule,
  ],
  providers: BOOKING_PAYMENT_QUERY_HANDLERS,
  exports: BOOKING_PAYMENT_QUERY_HANDLERS,
})
export class BookingPaymentQueryModule {}
