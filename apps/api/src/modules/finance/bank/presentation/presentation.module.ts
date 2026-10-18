import { Module } from '@nestjs/common';
import { BankAccountQueryController } from '@modules/finance/bank/presentation/http/controllers/bank-account.query.controller';
import { BankAccountCommandController } from '@modules/finance/bank/presentation/http/controllers/bank-account.command.controller';
import { BankStatementQueryController } from '@modules/finance/bank/presentation/http/controllers/bank-statement.query.controller';
import { BankStatementCommandController } from '@modules/finance/bank/presentation/http/controllers/bank-statement.command.controller';
import { ProviderSettlementCommandController } from '@modules/finance/bank/presentation/http/controllers/provider-settlement.command.controller';

@Module({
  controllers: [
    BankAccountQueryController,
    BankAccountCommandController,
    BankStatementQueryController,
    BankStatementCommandController,
    ProviderSettlementCommandController,
  ],
})
export class BankPresentationModule {}
