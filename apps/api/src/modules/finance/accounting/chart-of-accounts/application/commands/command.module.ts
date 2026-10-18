import { Module } from '@nestjs/common';
import { InitializeChartOfAccountsHandler } from './initialize-chart-of-accounts/initialize-chart-of-accounts.handler';
import { ChartOfAccountsEventModule } from '@modules/finance/accounting/chart-of-accounts/infrastructure/messaging/events/chart-of-accounts-event.module';
import { AccountRepositoriesModule } from '@modules/finance/accounting/chart-of-accounts/infrastructure/persistence/prisma/repositories/repositories.module';
import { ChartTemplateGuard } from '@modules/finance/accounting/chart-of-accounts/domain/services/template-integrity';

const CommandHandlers = [InitializeChartOfAccountsHandler];

@Module({
  imports: [AccountRepositoriesModule, ChartOfAccountsEventModule],
  // ChartTemplateGuard: şablonu açılışta doğrular (bozuk düzenleme deploy anında
  // patlar, ilk klinik kurulumunda değil).
  providers: [...CommandHandlers, ChartTemplateGuard],
  exports: [...CommandHandlers],
})
export class ChartOfAccountsCommandModule {}
