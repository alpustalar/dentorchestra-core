import { Module } from '@nestjs/common';
import {
  BANK_STATEMENT_COMMAND_REPOSITORY,
  BANK_STATEMENT_QUERY_REPOSITORY,
} from '@modules/finance/bank/domain/repositories/bank-statement/bank-statement.repository';
import {
  BANK_STATEMENT_LINE_COMMAND_REPOSITORY,
  BANK_STATEMENT_LINE_QUERY_REPOSITORY,
} from '@modules/finance/bank/domain/repositories/bank-statement-line/bank-statement-line.repository';
import { BankAccountCommandRepository } from './bank-account/bank-account.command.repository';
import { BankAccountQueryRepository } from './bank-account/bank-account.query.repository';
import { BankStatementCommandRepository } from './bank-statement/bank-statement.command.repository';
import { BankStatementQueryRepository } from './bank-statement/bank-statement.query.repository';
import { BankStatementLineCommandRepository } from './bank-statement-line/bank-statement-line.command.repository';
import { BankStatementLineQueryRepository } from './bank-statement-line/bank-statement-line.query.repository';
import { BANK_ACCOUNT_COMMAND_REPOSITORY } from '@modules/finance/bank/domain/repositories/bank-account/bank-account.command.repository';
import { BANK_ACCOUNT_QUERY_REPOSITORY } from '@modules/finance/bank/domain/repositories/bank-account/bank-account.query.repository';
import { PROVIDER_SETTLEMENT_COMMAND_REPOSITORY } from '@modules/finance/bank/domain/repositories/provider-settlement/provider-settlement.command.repository';
import { ProviderSettlementCommandRepository } from './provider-settlement/provider-settlement.command.repository';

@Module({
  providers: [
    {
      provide: BANK_ACCOUNT_COMMAND_REPOSITORY,
      useClass: BankAccountCommandRepository,
    },
    {
      provide: BANK_ACCOUNT_QUERY_REPOSITORY,
      useClass: BankAccountQueryRepository,
    },
    {
      provide: BANK_STATEMENT_COMMAND_REPOSITORY,
      useClass: BankStatementCommandRepository,
    },
    {
      provide: BANK_STATEMENT_QUERY_REPOSITORY,
      useClass: BankStatementQueryRepository,
    },
    {
      provide: BANK_STATEMENT_LINE_COMMAND_REPOSITORY,
      useClass: BankStatementLineCommandRepository,
    },
    {
      provide: BANK_STATEMENT_LINE_QUERY_REPOSITORY,
      useClass: BankStatementLineQueryRepository,
    },
    {
      provide: PROVIDER_SETTLEMENT_COMMAND_REPOSITORY,
      useClass: ProviderSettlementCommandRepository,
    },
  ],
  exports: [
    BANK_ACCOUNT_COMMAND_REPOSITORY,
    BANK_ACCOUNT_QUERY_REPOSITORY,
    BANK_STATEMENT_COMMAND_REPOSITORY,
    BANK_STATEMENT_QUERY_REPOSITORY,
    BANK_STATEMENT_LINE_COMMAND_REPOSITORY,
    BANK_STATEMENT_LINE_QUERY_REPOSITORY,
    PROVIDER_SETTLEMENT_COMMAND_REPOSITORY,
  ],
})
export class BankRepositoriesModule {}
