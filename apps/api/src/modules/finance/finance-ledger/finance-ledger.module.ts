import { FinanceLedgerQueryModule } from '@modules/finance/finance-ledger/application/queries/query.module';
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@common/constants';
import { FinanceLedgerPresentationModule } from './presentation/presentation.module';
import { FinanceLedgerProducer } from '@modules/finance/finance-ledger/infrastructure/messaging/queue/producers/finance-ledger.producer';
import { FinanceLedgerProcessor } from '@modules/finance/finance-ledger/infrastructure/messaging/queue/processors/finance-ledger.proccessor';
import {
  PaymentChargedBackListener,
  PaymentCompletedListener,
  PaymentRefundedListener,
} from '@modules/finance/finance-ledger/infrastructure/messaging/events/listeners';
import { FinanceLedgerCommandModule } from '@modules/finance/finance-ledger/application/commands/command.module';

const Listeners = [
  PaymentCompletedListener,
  PaymentRefundedListener,
  PaymentChargedBackListener,
];

@Module({
  imports: [
    FinanceLedgerCommandModule,
    FinanceLedgerQueryModule,
    BullModule.registerQueue({ name: QUEUES.FINANCE }),
    FinanceLedgerPresentationModule,
  ],
  providers: [FinanceLedgerProducer, FinanceLedgerProcessor, ...Listeners],
})
export class FinanceLedgerModule {}
