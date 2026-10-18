import { Module } from '@nestjs/common';
import { FindPosDevicesHandler } from './find-pos-devices/find-pos-devices.handler';
import { FindStalePosTransactionsHandler } from './find-stale-pos-transactions/find-stale-pos-transactions.handler';
import { FindUnbridgedPosTransactionsHandler } from './find-unbridged-pos-transactions/find-unbridged-pos-transactions.handler';
import { PosDeviceRepositoryModule } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-device/pos-device.repository.module';
import { PosTransactionRepositoryModule } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-transaction/pos-transaction.repository.module';
import { FinancialEventQueryModule } from '@modules/finance/accounting/financial-events/application/queries/query.module';

export const POS_QUERY_HANDLERS = [
  FindPosDevicesHandler,
  FindStalePosTransactionsHandler,
  FindUnbridgedPosTransactionsHandler,
];

@Module({
  imports: [
    PosDeviceRepositoryModule,
    PosTransactionRepositoryModule,
    // Köprü eksiği taraması "olayı var mı" sorusunu financial-events modülüne
    // QueryBus ile sorar; handler'ın kayıtlı olduğu modül import edilir.
    FinancialEventQueryModule,
  ],
  providers: POS_QUERY_HANDLERS,
  exports: POS_QUERY_HANDLERS,
})
export class PhysicalPosQueryModule {}
