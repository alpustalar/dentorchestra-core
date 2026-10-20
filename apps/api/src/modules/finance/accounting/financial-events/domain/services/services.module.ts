import { Module } from '@nestjs/common';
import { FinancialEventRepositoriesModule } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/repositories.module';
import { FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE } from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service.interface';
import { FinancialEventPostingCompletenessService } from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service';
import { FINANCIAL_EVENT_PRESENCE_GUARD } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard.interface';
import { FinancialEventPresenceGuard } from '@modules/finance/accounting/financial-events/domain/services/event-presence/event-presence.guard';

/**
 * Finansal olay domain servisleri — **yaprak** modül. Dönem kapanışı ve kart
 * itirazı yalnız bunu import eder; `FinancialEventModule`'ü import etmek
 * controller'ları da çeker.
 */
@Module({
  imports: [FinancialEventRepositoriesModule],
  providers: [
    {
      provide: FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE,
      useClass: FinancialEventPostingCompletenessService,
    },
    {
      provide: FINANCIAL_EVENT_PRESENCE_GUARD,
      useClass: FinancialEventPresenceGuard,
    },
  ],
  exports: [
    FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE,
    FINANCIAL_EVENT_PRESENCE_GUARD,
  ],
})
export class FinancialEventDomainServicesModule {}
