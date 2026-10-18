import { Module } from '@nestjs/common';
import { ChartOfAccountsPresentationModule } from './presentation/presentation.module';
import { ChartOfAccountsQueryModule } from '@modules/finance/accounting/chart-of-accounts/application/queries/query.module';

@Module({
  imports: [ChartOfAccountsPresentationModule, ChartOfAccountsQueryModule],
})
export class ChartOfAccountsModule {}
