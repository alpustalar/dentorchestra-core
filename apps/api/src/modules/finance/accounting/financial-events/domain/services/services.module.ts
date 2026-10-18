import { Module } from '@nestjs/common';
import { FinancialEventRepositoriesModule } from '@modules/finance/accounting/financial-events/infrastructure/persistence/prisma/repositories/repositories.module';
import { FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE } from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service.interface';
import { FinancialEventPostingCompletenessService } from '@modules/finance/accounting/financial-events/domain/services/posting-completeness/posting-completeness.service';

/**
 * Finansal olay domain servisleri — **yaprak** modül. Dönem kapanışı yalnız bunu
 * import eder; `FinancialEventModule`'ü import etmek controller'ları da çeker.
 */
@Module({
  imports: [FinancialEventRepositoriesModule],
  providers: [
    {
      provide: FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE,
      useClass: FinancialEventPostingCompletenessService,
    },
  ],
  exports: [FINANCIAL_EVENT_POSTING_COMPLETENESS_SERVICE],
})
export class FinancialEventDomainServicesModule {}
