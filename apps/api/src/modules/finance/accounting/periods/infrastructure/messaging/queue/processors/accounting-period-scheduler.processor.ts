import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ACCOUNTING_JOBS, QUEUES } from '@common/constants';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { EnsureLedgerPeriodsCommand } from '@modules/finance/accounting/periods/application/commands/ensure-ledger-periods/ensure-ledger-periods.command';

@Processor(QUEUES.ACCOUNTING)
export class AccountingPeriodSchedulerProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountingPeriodSchedulerProcessor.name);

  constructor(private readonly commandBus: TSCommandBus) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case ACCOUNTING_JOBS.OPEN_NEXT_YEAR_PERIODS:
        await this.commandBus.execute(new EnsureLedgerPeriodsCommand());
        break;
      default:
        this.logger.warn(`Tanımlanmamış muhasebe job: ${job.name}`);
    }
  }
}
