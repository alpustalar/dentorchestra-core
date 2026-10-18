import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, WORK_ORDER_JOBS } from '@common/constants';

/**
 * Gecikmiş iş emri taramasını BullMQ repeatable job olarak zamanlar. Her 30 dakikada
 * bir çalışır; işi {@link WorkOrderOverdueProcessor} alıp ScanOverdueWorkOrdersCommand'e
 * çevirir (idempotency `overdueNotifiedAt` ile entity tarafında).
 */
@Injectable()
export class WorkOrderOverdueSchedulerProducer implements OnModuleInit {
  private readonly logger = new Logger(WorkOrderOverdueSchedulerProducer.name);

  constructor(@InjectQueue(QUEUES.WORK_ORDER) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add(
      WORK_ORDER_JOBS.SCAN_OVERDUE,
      {},
      {
        repeat: { pattern: '*/30 * * * *' }, // her 30 dakikada bir
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    this.logger.log('Gecikmiş iş emri taraması zamanlandı (her 30 dk)');
  }
}
