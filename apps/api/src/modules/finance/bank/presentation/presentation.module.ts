import { Module } from '@nestjs/common';
import { BankAccountQueryController } from '@modules/finance/bank/presentation/http/controllers/bank-account.query.controller';
import { BankAccountCommandController } from '@modules/finance/bank/presentation/http/controllers/bank-account.command.controller';
import { BankStatementQueryController } from '@modules/finance/bank/presentation/http/controllers/bank-statement.query.controller';
import { BankStatementCommandController } from '@modules/finance/bank/presentation/http/controllers/bank-statement.command.controller';
import { ProviderSettlementCommandController } from '@modules/finance/bank/presentation/http/controllers/provider-settlement.command.controller';
import { CardChargebackCommandController } from '@modules/finance/bank/presentation/http/controllers/card-chargeback.command.controller';
import { CardChargebackQueryController } from '@modules/finance/bank/presentation/http/controllers/card-chargeback.query.controller';

@Module({
  controllers: [
    BankAccountQueryController,
    BankAccountCommandController,
    BankStatementQueryController,
    BankStatementCommandController,
    ProviderSettlementCommandController,
    CardChargebackCommandController,
    CardChargebackQueryController,
  ],
})
export class BankPresentationModule {}
