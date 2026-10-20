import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ACCOUNTING_JOBS, QUEUES } from '@common/constants';

const BOOT_JOB_DELAY_MS = 30_000;

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
    // Aylık cron yüzünden yeni bir dağıtım (ör. platform defteri ilk kez kapsama
    // girdiğinde) 31 güne kadar dönemsiz kalırdı → açılışta bir kerelik de çalıştır.
    // Sabit jobId: art arda yeniden başlatmalar kuyrukta tek iş bırakır.
    // Gecikme: worker, CQRS handler kaydı bitmeden işi alırsa "No handler found" ile
    // düşer (ölçüldü: ilk denemede böyle düştü). Başarısız iş de silinir; aksi halde
    // aynı jobId sonraki açılışlarda sessizce reddedilir ve iş bir daha hiç eklenmez.
    await this.queue.add(
      ACCOUNTING_JOBS.OPEN_NEXT_YEAR_PERIODS,
      {},
      {
        jobId: 'open-next-year-periods-on-boot',
        delay: BOOT_JOB_DELAY_MS,
        attempts: 3,
        backoff: { type: 'exponential', delay: BOOT_JOB_DELAY_MS },
        removeOnComplete: true,
        removeOnFail: true,
      }
    );
    this.logger.log(
      'Muhasebe dönemi kontrolü zamanlandı (aylık 03:00 TRT + açılışta bir kerelik)'
    );
  }
}
