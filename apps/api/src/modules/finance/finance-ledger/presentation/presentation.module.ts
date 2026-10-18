import { Module } from '@nestjs/common';
import { FinanceLedgerQueryController } from '@modules/finance/finance-ledger/presentation/http/controllers/finance-ledger.query.controller';
import { FinanceLedgerCommandController } from '@modules/finance/finance-ledger/presentation/http/controllers/finance-ledger.command.controller';

@Module({
  controllers: [FinanceLedgerQueryController, FinanceLedgerCommandController],
})
export class FinanceLedgerPresentationModule {}
