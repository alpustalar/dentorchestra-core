import { Module } from '@nestjs/common';
import { AccountingPeriodPresentationModule } from './presentation/presentation.module';
import { AccountingPeriodQueueModule } from './infrastructure/messaging/queue/accounting-period-queue.module';

@Module({
  imports: [AccountingPeriodPresentationModule, AccountingPeriodQueueModule],
})
export class AccountingPeriodModule {}
