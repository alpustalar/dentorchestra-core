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
import { StockInRule } from '@modules/finance/accounting/posting/domain/posting/rules/stock-in.rule';
import { PLATFORM_TENANT_PROVIDER } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { PlatformTenantProvider } from '@modules/finance/accounting/posting/infrastructure/platform-tenant.provider';
import { ChartOfAccountsCommandModule } from '@modules/finance/accounting/chart-of-accounts/application/commands/command.module';
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
  // ChartOfAccountsCommandModule: platform kliniğinin hesap planını ilk
  // kullanımda kuran idempotent komut için (PlatformTenantProvider).
  // AccountingPeriodDomainServicesModule: yevmiye numarası tahsisi (dönem satırı
  // sayacı + kilit) — yaprak modül, dönem modülünün tamamı çekilmez.
  imports: [
    JournalRepositoryModule,
    ChartOfAccountsCommandModule,
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
    PaymentMadeRule,
    StockOutRule,
    StockInRule,
    ProviderSettlementReceivedRule,
    { provide: PLATFORM_TENANT_PROVIDER, useClass: PlatformTenantProvider },
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
        paymentMade: PaymentMadeRule,
        stockOut: StockOutRule,
        stockIn: StockInRule,
        providerSettlement: ProviderSettlementReceivedRule
      ) => [
        paymentReceived,
        paymentRefunded,
        salesInvoiceIssued,
        purchaseInvoiceReceived,
        payrollAccrued,
        cashSessionClosed,
        platformBookingSettled,
        platformBookingRefunded,
        paymentMade,
        stockOut,
        stockIn,
        providerSettlement,
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
        PaymentMadeRule,
        StockOutRule,
        StockInRule,
        ProviderSettlementReceivedRule,
      ],
    },
    PostingRuleRegistry,
    // Model A — posting-time yabancı para çevrimi için FX kuru: TCMB işlem-tarihli döviz alış
    // kuru (VUK statutory); çözülemezse StaticEnv fallback.
    StaticEnvFxRateProvider,
    { provide: FX_RATE_PROVIDER, useClass: TcmbFxRateProvider },
  ],
  exports: [...CommandHandlers, PLATFORM_TENANT_PROVIDER],
})
export class PostingCommandModule {}
