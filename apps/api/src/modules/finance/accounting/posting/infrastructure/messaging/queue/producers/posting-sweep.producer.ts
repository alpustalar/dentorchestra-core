import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES } from '@common/constants';
import { POSTING_JOBS } from '@src/common/constants/jobs.constant';

/**
 * Fişlenmemiş ekonomik olay süpürmesini zamanlar.
 *
 * Neden **günlük**: posting hatası dinleyicide yutulduğu için bir fiş boşluğunun
 * kendiliğinden kapanma yolu yok. Tek otomatik kontrol dönem kapanışıydı (yılda
 * bir) — yani boşluk aylarca görünmeyebilirdi. Günlük tur, at-least-once teslimin
 * yerini alır: geçici hatalar (kilit çakışması, geçici bağlantı) kendi kendine
 * onarılır, kalıcı hata her gün CRITICAL uyarı üretir.
 */
@Injectable()
export class PostingSweepProducer implements OnModuleInit {
  private readonly logger = new Logger(PostingSweepProducer.name);

  constructor(@InjectQueue(QUEUES.POSTING) private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // TZ verilmezse BullMQ UTC çalışır → yerel takvim için tz zorunlu.
    await this.queue.add(
      POSTING_JOBS.SWEEP_UNPOSTED_FINANCIAL_EVENTS,
      {},
      {
        repeat: { pattern: '0 4 * * *', tz: 'Europe/Istanbul' }, // her gün 04:00 TRT
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
    this.logger.log('Fişlenmemiş olay süpürmesi zamanlandı (günlük 04:00 TRT)');
  }
}
