import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FINANCE_JOBS, QUEUES } from '@common/constants';
import { Logger } from '@nestjs/common';
import { ILedgerJobData } from '../producers/finance-ledger.producer';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { SyncInstallmentLedgerEntryCommand } from '@modules/finance/finance-ledger/application/commands/sync-installment-ledger-entry/sync-installment-ledger-entry.command';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';

@Processor(QUEUES.FINANCE)
export class FinanceLedgerProcessor extends WorkerHost {
  private readonly logger = new Logger(FinanceLedgerProcessor.name);

  constructor(private readonly commandBus: TSCommandBus) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case FINANCE_JOBS.PROCESS_LEDGER:
        return this.handleLedgerEntry(job.data as ILedgerJobData);
      case FINANCE_JOBS.GENERATE_INVOICE:
        return;
      default:
        throw new Error(`Tanımlanmamış iş tipi: ${job.name}`);
    }
  }

  /**
   * İş yalnız kimliği taşır; "ne yazılacağı" kararı komutun içinde, kaynağın
   * o anki durumu okunarak verilir. Hata YUTULMAZ — yeniden denenmesi için
   * yukarı fırlatılır (5 deneme), elde kalan iş failed set'te durur ve
   * mutabakat sorgusunda da görünür.
   */
  private async handleLedgerEntry(data: ILedgerJobData): Promise<void> {
    this.logger.log(
      `Cari kaydı işleniyor: installmentId=${data.installmentId} reason=${data.reason}`
    );

    const { outcome } = await this.commandBus.execute(
      new SyncInstallmentLedgerEntryCommand({
        installmentId: data.installmentId,
        actorId: data.actorId,
        ctx: ExecutionContextFactory.createInternal(),
      })
    );

    this.logger.log(
      `Cari kaydı sonucu: installmentId=${data.installmentId} outcome=${outcome}`
    );
  }
}
