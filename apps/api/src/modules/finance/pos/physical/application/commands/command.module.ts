import { Module } from '@nestjs/common';
import { RegisterPosDeviceHandler } from './register-pos-device/register-pos-device.handler';
import { InitiatePosTransactionHandler } from './initiate-pos-transaction/initiate-pos-transaction.handler';
import { HandlePosCallbackHandler } from './handle-pos-callback/handle-pos-callback.handler';
import { ReconcilePosTransactionsHandler } from './reconcile-pos-transactions/reconcile-pos-transactions.handler';
import { PaxSaleHandler } from './pax-sale/pax-sale.handler';
import { PaxVoidHandler } from './pax-void/pax-void.handler';
import { PaxRefundHandler } from './pax-refund/pax-refund.handler';
import { PaxBatchCloseHandler } from './pax-batch-close/pax-batch-close.handler';
import { IyzicoTerminalSaleHandler } from './iyzico-terminal-sale/iyzico-terminal-sale.handler';
import { IyzicoTerminalRefundHandler } from './iyzico-terminal-refund/iyzico-terminal-refund.handler';
import { IyzicoTerminalVoidHandler } from './iyzico-terminal-void/iyzico-terminal-void.handler';
import { IyzicoTerminalEodHandler } from './iyzico-terminal-eod/iyzico-terminal-eod.handler';
import { RegisterClinicIyzicoTerminalConfigHandler } from './register-clinic-iyzico-terminal-config/register-clinic-iyzico-terminal-config.handler';
import { BackfillPosAccountingEventsHandler } from './backfill-pos-accounting-events/backfill-pos-accounting-events.handler';
import { PosDeviceRepositoryModule } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-device/pos-device.repository.module';
import { PosTransactionRepositoryModule } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/pos-transaction/pos-transaction.repository.module';
import { ClinicIyzicoTerminalConfigRepositoryModule } from '@modules/finance/pos/physical/infrastructure/persistence/prisma/repositories/clinic-iyzico-terminal-config/clinic-iyzico-terminal-config.repository.module';
import { PaxModule } from '@src/infrastructure/payment/pos/physical/providers/pax/pax.module';
import { IyzicoTerminalModule } from '@src/infrastructure/payment/pos/physical/providers/iyzico-terminal/iyzico-terminal.module';
import { PaymentModule } from '@modules/finance/payment/payment.module';
import { PolicyModule } from '@modules/platform/policy/policy.module';
import { PosPaymentSyncService } from '@modules/finance/pos/physical/application/services/pos-payment-sync.service';
import { PosAccountingBridgeService } from '@modules/finance/pos/physical/application/services/pos-accounting-bridge.service';
import { ResolveIyzicoTerminalCredentialsService } from '@modules/finance/pos/physical/application/services/resolve-iyzico-terminal-credentials.service';
import { PosInfrastructureModule } from '@src/infrastructure/payment/pos/pos.infrastructure.module';
import { PhysicalPosQueryModule } from '@modules/finance/pos/physical/application/queries/query.module';

export const POS_COMMAND_HANDLERS = [
  RegisterPosDeviceHandler,
  InitiatePosTransactionHandler,
  HandlePosCallbackHandler,
  ReconcilePosTransactionsHandler,
  PaxSaleHandler,
  PaxVoidHandler,
  PaxRefundHandler,
  PaxBatchCloseHandler,
  IyzicoTerminalSaleHandler,
  IyzicoTerminalRefundHandler,
  IyzicoTerminalVoidHandler,
  IyzicoTerminalEodHandler,
  RegisterClinicIyzicoTerminalConfigHandler,
  BackfillPosAccountingEventsHandler,
];

@Module({
  imports: [
    PosDeviceRepositoryModule,
    PosTransactionRepositoryModule,
    ClinicIyzicoTerminalConfigRepositoryModule,
    PaxModule,
    IyzicoTerminalModule,
    PaymentModule,
    PolicyModule,
    PosInfrastructureModule,
    // Telafi komutu `FindUnbridgedPosTransactionsQuery`'yi bus ile çağırır;
    // handler'ın kayıtlı olduğu modül burada da import edilir.
    PhysicalPosQueryModule,
  ],
  providers: [
    ...POS_COMMAND_HANDLERS,
    PosPaymentSyncService,
    PosAccountingBridgeService,
    ResolveIyzicoTerminalCredentialsService,
  ],
  exports: POS_COMMAND_HANDLERS,
})
export class PhysicalPosCommandModule {}
