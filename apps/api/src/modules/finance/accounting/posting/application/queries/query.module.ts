import { Module } from '@nestjs/common';
import { GetJournalEntriesHandler } from './get-journal-entries/get-journal-entries.handler';
import { GetTrialBalanceHandler } from './get-trial-balance/get-trial-balance.handler';
import { GetAccountLedgerHandler } from './get-account-ledger/get-account-ledger.handler';
import { GetJournalReportHandler } from './get-journal-report/get-journal-report.handler';
import { GetIncomeStatementHandler } from './get-income-statement/get-income-statement.handler';
import { GetBalanceSheetHandler } from './get-balance-sheet/get-balance-sheet.handler';
import { GetCashFlowHandler } from './get-cash-flow/get-cash-flow.handler';
import { GetVatDeclarationHandler } from './get-vat-declaration/get-vat-declaration.handler';
import { GetBankLedgerLinesHandler } from './get-bank-ledger-lines/get-bank-ledger-lines.handler';
import { GetYearEndClosingPreviewHandler } from './get-year-end-closing-preview/get-year-end-closing-preview.handler';
import { JournalRepositoryModule } from '@modules/finance/accounting/posting/infrastructure/persistence/prisma/repositories/journal/journal.repository.module';

const QueryHandlers = [
  GetJournalEntriesHandler,
  GetTrialBalanceHandler,
  GetAccountLedgerHandler,
  GetJournalReportHandler,
  GetIncomeStatementHandler,
  GetBalanceSheetHandler,
  GetCashFlowHandler,
  GetVatDeclarationHandler,
  GetBankLedgerLinesHandler,
  GetYearEndClosingPreviewHandler,
];

@Module({
  imports: [JournalRepositoryModule],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class PostingQueryModule {}
