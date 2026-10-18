import { Module } from '@nestjs/common';
import { GetChartOfAccountsHandler } from './get-chart-of-accounts/get-chart-of-accounts.handler';
import { GetChartOfAccountsDriftHandler } from './get-chart-of-accounts-drift/get-chart-of-accounts-drift.handler';
import { AccountRepositoriesModule } from '@modules/finance/accounting/chart-of-accounts/infrastructure/persistence/prisma/repositories/repositories.module';

const QueryHandlers = [
  GetChartOfAccountsHandler,
  GetChartOfAccountsDriftHandler,
];

@Module({
  imports: [AccountRepositoriesModule],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class ChartOfAccountsQueryModule {}
