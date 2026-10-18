import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { CHART_OF_ACCOUNTS_EVENT_PUBLISHER } from '@modules/finance/accounting/chart-of-accounts/domain/interfaces/chart-of-accounts-event-publisher.interface';
import { ChartOfAccountsEventPublisher } from './chart-of-accounts-event-publisher.service';
import { ChartOfAccountsInitializedListener } from './listeners';

@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [
    {
      provide: CHART_OF_ACCOUNTS_EVENT_PUBLISHER,
      useClass: ChartOfAccountsEventPublisher,
    },
    ChartOfAccountsInitializedListener,
  ],
  exports: [CHART_OF_ACCOUNTS_EVENT_PUBLISHER],
})
export class ChartOfAccountsEventModule {}
