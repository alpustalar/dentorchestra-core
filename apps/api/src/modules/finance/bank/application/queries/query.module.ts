import { Module } from '@nestjs/common';
import { GetBankAccountsHandler } from './get-bank-accounts/get-bank-accounts.handler';
import { GetBankAccountByIdHandler } from './get-bank-account-by-id/get-bank-account-by-id.handler';
import { GetBankStatementsHandler } from './get-bank-statements/get-bank-statements.handler';
import { GetBankStatementByIdHandler } from './get-bank-statement-by-id/get-bank-statement-by-id.handler';
import { GetReconciliationSummaryHandler } from './get-reconciliation-summary/get-reconciliation-summary.handler';
import { GetLineMatchSuggestionsHandler } from './get-line-match-suggestions/get-line-match-suggestions.handler';
import { GetCardChargebacksHandler } from './get-card-chargebacks/get-card-chargebacks.handler';
import { BankRepositoriesModule } from '@modules/finance/bank/infrastructure/persistence/prisma/repositories/repositories.module';

export const BANK_QUERY_HANDLERS = [
  GetBankAccountsHandler,
  GetBankAccountByIdHandler,
  GetBankStatementsHandler,
  GetBankStatementByIdHandler,
  GetReconciliationSummaryHandler,
  GetLineMatchSuggestionsHandler,
  GetCardChargebacksHandler,
];

@Module({
  // PostingQueryModule: aday önerileri 102 defterinden QueryBus ile gelir.
  imports: [BankRepositoriesModule],
  providers: BANK_QUERY_HANDLERS,
  exports: BANK_QUERY_HANDLERS,
})
export class BankQueryModule {}
