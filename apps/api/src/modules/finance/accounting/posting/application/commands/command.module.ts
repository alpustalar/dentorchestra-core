import { Module } from '@nestjs/common';
import { PostFinancialEventHandler } from './post-financial-event/post-financial-event.handler';
import { ReverseJournalEntryHandler } from './reverse-journal-entry/reverse-journal-entry.handler';
import { ReverseJournalEntryByEventHandler } from './reverse-journal-entry-by-event/reverse-journal-entry-by-event.handler';
import { GenerateYearEndClosingHandler } from './generate-year-end-closing/generate-year-end-closing.handler';
import { PostUnpostedFinancialEventsHandler } from './post-unposted-financial-events/post-unposted-financial-events.handler';
import { SweepUnpostedFinancialEventsHandler } from './sweep-unposted-financial-events/sweep-unposted-financial-events.handler';
import { AccountingPeriodDomainServicesModule } from '@modules/finance/accounting/periods/domain/services/services.module';
import { JournalRepositoryModule } from '@modules/finance/accounting/posting/infrastructure/persistence/prisma/repositories/journal/journal.repository.module';
import { POSTING_RULES } from '@modules/finance/accounting/posting/domain/posting/posting-rule.interface';
import { PostingRuleRegistry } from '@modules/finance/accounting/posting/domain/posting/posting-rule.registry';
import { PaymentReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/payment-received.rule';
import { PaymentRefundedRule } from '@modules/finance/accounting/posting/domain/posting/rules/payment-refunded.rule';
import { SalesInvoiceIssuedRule } from '@modules/finance/accounting/posting/domain/posting/rules/sales-invoice-issued.rule';
import { PurchaseInvoiceReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/purchase-invoice-received.rule';
import { PayrollAccruedRule } from '@modules/finance/accounting/posting/domain/posting/rules/payroll-accrued.rule';
import { CashSessionClosedRule } from '@modules/finance/accounting/posting/domain/posting/rules/cash-session-closed.rule';
import { PlatformBookingSettledRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-booking-settled.rule';
import { PlatformBookingRefundedRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-booking-refunded.rule';
import { PaymentMadeRule } from '@modules/finance/accounting/posting/domain/posting/rules/payment-made.rule';
import { StockOutRule } from '@modules/finance/accounting/posting/domain/posting/rules/stock-out.rule';
import { ProviderSettlementReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/provider-settlement-received.rule';
import { CardChargebackOpenedRule } from '@modules/finance/accounting/posting/domain/posting/rules/card-chargeback-opened.rule';
import { CardChargebackWonRule } from '@modules/finance/accounting/posting/domain/posting/rules/card-chargeback-won.rule';
import { CardChargebackLostRule } from '@modules/finance/accounting/posting/domain/posting/rules/card-chargeback-lost.rule';
import { StockInRule } from '@modules/finance/accounting/posting/domain/posting/rules/stock-in.rule';
import { PlatformReturnableChargeReceivedRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-returnable-charge-received.rule';
import { PlatformReturnableChargeRefundedRule } from '@modules/finance/accounting/posting/domain/posting/rules/platform-returnable-charge-refunded.rule';
import { PlatformTenantModule } from '@modules/finance/accounting/posting/infrastructure/platform-tenant.module';
import { FX_RATE_PROVIDER } from '@src/infrastructure/payment/links/fx-rate.port';
import { StaticEnvFxRateProvider } from '@src/infrastructure/payment/links/adapters/static-env-fx-rate.provider';
import { TcmbFxRateProvider } from '@src/infrastructure/payment/links/adapters/tcmb-fx-rate.provider';
import { FinancialEventRepositoryModule } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/financial-event/financial-event.repository.module';

const CommandHandlers = [
  PostFinancialEventHandler,
  ReverseJournalEntryHandler,
  ReverseJournalEntryByEventHandler,
  GenerateYearEndClosingHandler,
  PostUnpostedFinancialEventsHandler,
  SweepUnpostedFinancialEventsHandler,
];

@Module({
  // PlatformTenantModule: platform kliniğini çözen yaprak modül (hesap planını ilk
  // kullanımda kuran idempotent komut içeride).
  // AccountingPeriodDomainServicesModule: yevmiye numarası tahsisi (dönem satırı
  // sayacı + kilit) — yaprak modül, dönem modülünün tamamı çekilmez.
  imports: [
    JournalRepositoryModule,
    PlatformTenantModule,
    AccountingPeriodDomainServicesModule,
    // Belge iptalinin storno zinciri: dedupeKey → FinancialEvent → fiş.
    // Yaprak repository modülü (yalnız Prisma'ya bağlı) — olay modülünün tamamı
    // çekilmez.
    FinancialEventRepositoryModule,
  ],
  providers: [
    ...CommandHandlers,
    PaymentReceivedRule,
    PaymentRefundedRule,
    SalesInvoiceIssuedRule,
    PurchaseInvoiceReceivedRule,
    PayrollAccruedRule,
    CashSessionClosedRule,
    PlatformBookingSettledRule,
    PlatformBookingRefundedRule,
    PlatformReturnableChargeReceivedRule,
    PlatformReturnableChargeRefundedRule,
    PaymentMadeRule,
    StockOutRule,
    StockInRule,
    ProviderSettlementReceivedRule,
    CardChargebackOpenedRule,
    CardChargebackWonRule,
    CardChargebackLostRule,
    {
      provide: POSTING_RULES,
      useFactory: (
        paymentReceived: PaymentReceivedRule,
        paymentRefunded: PaymentRefundedRule,
        salesInvoiceIssued: SalesInvoiceIssuedRule,
        purchaseInvoiceReceived: PurchaseInvoiceReceivedRule,
        payrollAccrued: PayrollAccruedRule,
        cashSessionClosed: CashSessionClosedRule,
        platformBookingSettled: PlatformBookingSettledRule,
        platformBookingRefunded: PlatformBookingRefundedRule,
        platformReturnableChargeReceived: PlatformReturnableChargeReceivedRule,
        platformReturnableChargeRefunded: PlatformReturnableChargeRefundedRule,
        paymentMade: PaymentMadeRule,
        stockOut: StockOutRule,
        stockIn: StockInRule,
        providerSettlement: ProviderSettlementReceivedRule,
        cardChargebackOpened: CardChargebackOpenedRule,
        cardChargebackWon: CardChargebackWonRule,
        cardChargebackLost: CardChargebackLostRule
      ) => [
        paymentReceived,
        paymentRefunded,
        salesInvoiceIssued,
        purchaseInvoiceReceived,
        payrollAccrued,
        cashSessionClosed,
        platformBookingSettled,
        platformBookingRefunded,
        platformReturnableChargeReceived,
        platformReturnableChargeRefunded,
        paymentMade,
        stockOut,
        stockIn,
        providerSettlement,
        cardChargebackOpened,
        cardChargebackWon,
        cardChargebackLost,
      ],
      inject: [
        PaymentReceivedRule,
        PaymentRefundedRule,
        SalesInvoiceIssuedRule,
        PurchaseInvoiceReceivedRule,
        PayrollAccruedRule,
        CashSessionClosedRule,
        PlatformBookingSettledRule,
        PlatformBookingRefundedRule,
        PlatformReturnableChargeReceivedRule,
        PlatformReturnableChargeRefundedRule,
        PaymentMadeRule,
        StockOutRule,
        StockInRule,
        ProviderSettlementReceivedRule,
        CardChargebackOpenedRule,
        CardChargebackWonRule,
        CardChargebackLostRule,
      ],
    },
    PostingRuleRegistry,
    // Model A — posting-time yabancı para çevrimi için FX kuru: TCMB işlem-tarihli döviz alış
    // kuru (VUK statutory); çözülemezse StaticEnv fallback.
    StaticEnvFxRateProvider,
    { provide: FX_RATE_PROVIDER, useClass: TcmbFxRateProvider },
  ],
  exports: [...CommandHandlers, PlatformTenantModule],
})
export class PostingCommandModule {}
