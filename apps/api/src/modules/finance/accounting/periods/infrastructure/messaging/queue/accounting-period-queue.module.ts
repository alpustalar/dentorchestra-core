import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@common/constants';
import { AccountingPeriodSchedulerProducer } from './producers/accounting-period-scheduler.producer';
import { AccountingPeriodSchedulerProcessor } from './processors/accounting-period-scheduler.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.ACCOUNTING })],
  providers: [
    AccountingPeriodSchedulerProducer,
    AccountingPeriodSchedulerProcessor,
  ],
})
export class AccountingPeriodQueueModule {}
