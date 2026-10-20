import { Module } from '@nestjs/common';
import { OpenPeriodHandler } from './open-period/open-period.handler';
import { LockPeriodHandler } from './lock-period/lock-period.handler';
import { ReopenPeriodHandler } from './reopen-period/reopen-period.handler';
import { ClosePeriodHandler } from './close-period/close-period.handler';
import { EnsureLedgerPeriodsHandler } from './ensure-ledger-periods/ensure-ledger-periods.handler';
import { AccountingPeriodRepositoryModule } from '@modules/finance/accounting/periods/infrastructure/persistence/prisma/repositories/accounting-period/accounting-period.repository.module';
import { AccountingPeriodEventModule } from '@modules/finance/accounting/periods/infrastructure/messaging/events/accounting-period-event.module';
import { FinancialEventDomainServicesModule } from '@modules/finance/accounting/financial-events/domain/services/services.module';
import { PlatformTenantModule } from '@modules/finance/accounting/posting/infrastructure/platform-tenant.module';

const CommandHandlers = [
  OpenPeriodHandler,
  LockPeriodHandler,
  ReopenPeriodHandler,
  ClosePeriodHandler,
  EnsureLedgerPeriodsHandler,
];

@Module({
  imports: [
    AccountingPeriodRepositoryModule,
    // Dönem geçişlerinin denetim izi (audit listener).
    AccountingPeriodEventModule,
    // Kapanış ön koşulu: fişlenmemiş ekonomik olay kalmamalı. Yaprak domain-servis
    // modülü — FinancialEventModule'ün tamamı (controller'lar dahil) çekilmez.
    FinancialEventDomainServicesModule,
    // Dönem açan iş platform kiracısını da kapsar (kural 5).
    PlatformTenantModule,
  ],
  providers: [...CommandHandlers],
  exports: [...CommandHandlers],
})
export class AccountingPeriodCommandModule {}
