import { Module } from '@nestjs/common';
import { AccountingPeriodQueryController } from '@modules/finance/accounting/periods/presentation/http/controllers/accounting-period.query.controller';
import { AccountingPeriodCommandController } from '@modules/finance/accounting/periods/presentation/http/controllers/accounting-period.command.controller';

@Module({
  controllers: [
    AccountingPeriodQueryController,
    AccountingPeriodCommandController,
  ],
})
export class AccountingPeriodPresentationModule {}
