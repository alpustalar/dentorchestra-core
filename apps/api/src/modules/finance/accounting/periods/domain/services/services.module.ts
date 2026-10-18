import { Module } from '@nestjs/common';
import { AccountingPeriodRepositoriesModule } from '@modules/finance/accounting/periods/infrastructure/persistence/prisma/repositories/repositories.module';
import { JOURNAL_ENTRY_NUMBERING_SERVICE } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service.interface';
import { JournalEntryNumberingService } from '@modules/finance/accounting/periods/domain/services/entry-numbering/journal-entry-numbering.service';
import { PERIOD_GATE_SERVICE } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service.interface';
import { PeriodGateService } from '@modules/finance/accounting/periods/domain/services/period-gate/period-gate.service';

/**
 * Dönem domain servisleri — **yaprak** modül. Posting yalnız bunu import eder;
 * `AccountingPeriodModule`'ü import etmek controller'ları ve tüm handler'ları da
 * beraberinde çeker ve döngü riski üretir.
 */
@Module({
  imports: [AccountingPeriodRepositoriesModule],
  providers: [
    {
      provide: JOURNAL_ENTRY_NUMBERING_SERVICE,
      useClass: JournalEntryNumberingService,
    },
    {
      provide: PERIOD_GATE_SERVICE,
      useClass: PeriodGateService,
    },
  ],
  exports: [JOURNAL_ENTRY_NUMBERING_SERVICE, PERIOD_GATE_SERVICE],
})
export class AccountingPeriodDomainServicesModule {}
