import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { OutboxRepository } from '@src/infrastructure/persistence/prisma/outbox/outbox.repository';

@Global()
@Module({
  providers: [PrismaService, TransactionManager, OutboxRepository],
  // `OutboxRepository` de dışa açılır: teslim işçisi (`OutboxProcessor`) artık
  // ham `PrismaService` ile değil, sahiplenme/işaretleme sözleşmesini tek yerde
  // tutan bu repo ile çalışıyor.
  exports: [PrismaService, TransactionManager, OutboxRepository],
})
export class PrismaModule {}
