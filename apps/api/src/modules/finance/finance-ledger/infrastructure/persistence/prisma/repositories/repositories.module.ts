import { Module } from '@nestjs/common';
import { FinanceLedgerRepositoryModule } from '@modules/finance/finance-ledger/infrastructure/persistence/prisma/repositories/finance-ledger/finance-ledger.repository.module';

const RepositoriesModules = [FinanceLedgerRepositoryModule];

@Module({
  imports: [...RepositoriesModules],
  exports: [...RepositoriesModules],
})
export class FinanceLedgerRepositoriesModule {}
