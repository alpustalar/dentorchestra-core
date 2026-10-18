import { Module } from '@nestjs/common';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { AccountingPeriodModule } from './periods/accounting-period.module';
import { FinancialEventModule } from './financial-events/financial-event.module';
import { PostingModule } from './posting/posting.module';
import { TaxParameterModule } from './tax-parameters/tax-parameter.module';
import { FinancialEventCommandModule } from '@modules/finance/accounting/financial-events/application/commands/command.module';
import { FinancialEventQueryModule } from '@modules/finance/accounting/financial-events/application/queries/query.module';
import { AccountingPeriodCommandModule } from '@modules/finance/accounting/periods/application/commands/command.module';
import { AccountingPeriodQueryModule } from '@modules/finance/accounting/periods/application/queries/query.module';

@Module({
  imports: [
    ChartOfAccountsModule,
    AccountingPeriodModule,
    FinancialEventModule,
    PostingModule,
    TaxParameterModule,
    FinancialEventCommandModule,
    FinancialEventQueryModule,
    AccountingPeriodCommandModule,
    AccountingPeriodQueryModule,
  ],
  exports: [
    ChartOfAccountsModule,
    AccountingPeriodModule,
    FinancialEventModule,
    PostingModule,
    TaxParameterModule,
  ],
})
export class AccountingModule {}
