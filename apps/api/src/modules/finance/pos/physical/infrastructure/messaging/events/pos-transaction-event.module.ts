import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { PosTransactionListener } from './listeners/pos-transaction.listener';

@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [PosTransactionListener],
})
export class PosTransactionEventModule {}
