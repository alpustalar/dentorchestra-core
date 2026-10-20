import { BankDomainServicesModule } from '@modules/finance/bank/domain/services/services.module';
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentLinkModule } from '@src/infrastructure/payment/links/payment-link.module';
import { IyzicoModule } from '@src/infrastructure/payment/pos/virtual/providers/iyzico/iyzico.module';
import { BookingPaymentRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/booking-payment/booking-payment.repository.module';
import { BookingPaymentRefundRepositoryModule } from '../../infrastructure/persistence/prisma/repositories/booking-payment-refund/booking-payment-refund.repository.module';
import { BookingPaymentRefundExecutor } from './../services/booking-payment-refund.executor';
import { InitiateBookingPaymentHandler } from './initiate-booking-payment/initiate-booking-payment.handler';
import { ConfirmBookingPaymentHandler } from './confirm-booking-payment/confirm-booking-payment.handler';
import { HandleBookingPaymentIyzicoCallbackHandler } from './handle-iyzico-callback/handle-iyzico-callback.handler';
import { ResolveBookingPaymentRefundHandler } from './resolve-booking-payment-refund/resolve-booking-payment-refund.handler';
import { RetryBookingPaymentRefundHandler } from './retry-booking-payment-refund/retry-booking-payment-refund.handler';
import { AccountingPeriodDomainServicesModule } from '@modules/finance/accounting/periods/domain/services/services.module';
import { FinancialEventDomainServicesModule } from '@modules/finance/accounting/financial-events/domain/services/services.module';
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
  ResolveBookingPaymentRefundHandler,
  RetryBookingPaymentRefundHandler,
  BackfillBookingLedgerEntriesHandler,
];

@Module({
  imports: [
    CqrsModule,
    PaymentLinkModule,
    IyzicoModule,
    BookingPaymentRepositoryModule,
    BookingPaymentRefundRepositoryModule,
    // Tahsilat platform defterine yazılır; PLATFORM_TENANT_PROVIDER buradan gelir.
    PostingCommandModule,
    // Elle karar: dönem kapısı (iadenin gerçekleştiği gün) ve "ters fiş zaten yazılı mı"
    // kanıtı — ikisi de yaprak domain-servis modülü, sahiplerinin ana modülü çekilmez.
    AccountingPeriodDomainServicesModule,
    // Kart itirazı tavan kapısı (kural 17): iade/iptal claim'inde aktif itiraz kontrolü.
    BankDomainServicesModule,
    FinancialEventDomainServicesModule,
    // Telafi komutu "eksik kalanlar" sorgusunu bus üzerinden çağırır.
    BookingPaymentQueryModule,
  ],
  providers: [
    ...BOOKING_PAYMENT_COMMAND_HANDLERS,
    BookingPlatformLedgerService,
    BookingPaymentRefundExecutor,
  ],
  exports: BOOKING_PAYMENT_COMMAND_HANDLERS,
})
export class BookingPaymentCommandModule {}
