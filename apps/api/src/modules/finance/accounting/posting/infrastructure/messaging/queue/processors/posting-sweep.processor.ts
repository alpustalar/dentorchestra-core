import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUES } from '@common/constants';
import { POSTING_JOBS } from '@src/common/constants/jobs.constant';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { SweepUnpostedFinancialEventsCommand } from '@modules/finance/accounting/posting/application/commands/sweep-unposted-financial-events/sweep-unposted-financial-events.command';

@Processor(QUEUES.POSTING)
export class PostingSweepProcessor extends WorkerHost {
  private readonly logger = new Logger(PostingSweepProcessor.name);

  constructor(private readonly commandBus: TSCommandBus) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case POSTING_JOBS.SWEEP_UNPOSTED_FINANCIAL_EVENTS:
        await this.commandBus.execute(
          new SweepUnpostedFinancialEventsCommand()
        );
        break;
      default:
        this.logger.warn(`Tanımlanmamış posting job: ${job.name}`);
    }
  }
}
