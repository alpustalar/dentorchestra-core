import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ACCOUNTING_JOBS, QUEUES } from '@common/constants';

/**
 * Defter dönemlerini zamanlanmış olarak garanti eder.
 *
 * Neden **aylık** (yıllık değil): iş idempotent ve ucuz; aylık tekrar, işin
 * çalışması gereken tek güne (31 Aralık) denk gelen bir kesintiyi kendi kendine
 * onarır. Yıllık tek atış, o gün süreç ayakta değilse yıl dönümünde tüm posting'i
 * durdururdu.
 */
@Injectable()
export class AccountingPeriodSchedulerProducer implements OnModuleInit {
  private readonly logger = new Logger(AccountingPeriodSchedulerProducer.name);

  constructor(@InjectQueue(QUEUES.ACCOUNTING) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // TZ verilmezse BullMQ UTC çalışır → yerel takvim için tz zorunlu.
    await this.queue.add(
      ACCOUNTING_JOBS.OPEN_NEXT_YEAR_PERIODS,
      {},
      {
        repeat: { pattern: '0 3 1 * *', tz: 'Europe/Istanbul' }, // her ayın 1'i 03:00 TRT
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    this.logger.log('Muhasebe dönemi kontrolü zamanlandı (aylık 03:00 TRT)');
  }
}
