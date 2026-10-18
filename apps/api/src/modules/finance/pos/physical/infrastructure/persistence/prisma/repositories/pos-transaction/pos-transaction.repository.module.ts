import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/infrastructure/persistence/prisma/prisma.module';
import { POS_TRANSACTION_COMMAND_REPOSITORY } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.command.repository';
import { POS_TRANSACTION_QUERY_REPOSITORY } from '@modules/finance/pos/physical/domain/repositories/pos-transaction/pos-transaction.query.repository';
import { PosTransactionCommandRepository } from './pos-transaction.command.repository';
import { PosTransactionQueryRepository } from './pos-transaction.query.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: POS_TRANSACTION_COMMAND_REPOSITORY,
      useClass: PosTransactionCommandRepository,
    },
    {
      provide: POS_TRANSACTION_QUERY_REPOSITORY,
      useClass: PosTransactionQueryRepository,
    },
  ],
  exports: [
    POS_TRANSACTION_COMMAND_REPOSITORY,
    POS_TRANSACTION_QUERY_REPOSITORY,
  ],
})
export class PosTransactionRepositoryModule {}
