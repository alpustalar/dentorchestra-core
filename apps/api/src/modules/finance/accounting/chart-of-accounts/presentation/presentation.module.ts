import { Module } from '@nestjs/common';
import { ChartOfAccountsCommandController } from '@modules/finance/accounting/chart-of-accounts/presentation/http/controllers/chart-of-accounts.command.controller';
import { ChartOfAccountsQueryController } from '@modules/finance/accounting/chart-of-accounts/presentation/http/controllers/chart-of-accounts.query.controller';

@Module({
  controllers: [
    ChartOfAccountsCommandController,
    ChartOfAccountsQueryController,
  ],
})
export class ChartOfAccountsPresentationModule {}
