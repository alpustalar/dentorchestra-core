import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { QUEUES } from '@common/constants';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import {
  ClaimedOutboxRecord,
  OutboxRepository,
} from '@src/infrastructure/persistence/prisma/outbox/outbox.repository';
import {
  OUTBOX_BATCH_SIZE,
  OUTBOX_MAX_ATTEMPTS,
} from '@src/infrastructure/persistence/prisma/outbox/outbox.constants';

/**
 * Outbox teslim işçisi: `outboxRun()` ile mühürlenen kritik event'leri okuyup
 * in-memory yayınlar.
 *
 * **Teslim edildi = dinleyici bitti.** Dinleyiciler `@OnDomainEvent` ile
 * kaydedildiği için `emitAsync` onları gerçekten bekler ve hataları buraya
 * ulaşır (çıplak `@OnEvent` ikisini de yapmıyordu: kayıt dinleyici başlamadan
 * "işlendi" oluyordu). Bu yüzden `markProcessed` yalnız başarıda çağrılır;
 * hatada kayıt açık kalır ve kiralama süresi dolunca yeniden denenir.
 */
@Processor(QUEUES.OUTBOX)
export class OutboxProcessor extends WorkerHost {
  private readonly logger = new Logger(OutboxProcessor.name);

  constructor(
    private readonly outboxRepo: OutboxRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly criticalFailure: CriticalFailurePublisher
  ) {
    super();
  }

  async process(): Promise<void> {
    const records = await this.outboxRepo.claimPending(OUTBOX_BATCH_SIZE);

    if (records.length === 0) return;

    this.logger.log(`Processing ${records.length} outbox records`);

    for (const record of records) {
      await this.deliver(record);
    }
  }

  private async deliver(record: ClaimedOutboxRecord): Promise<void> {
    // Dinleyicisi olmayan bir event yayınlamak sessiz bir düşüştür: event adı
    // değişmiş ya da modül hiç yüklenmemiş olabilir. Kayıt kapatılmaz — hata
    // gibi işlenir ki görünür kalsın ve sebep giderildiğinde yeniden denenebilsin.
    if (this.eventEmitter.listenerCount(record.type) === 0) {
      await this.fail(
        record,
        `Bu event türü için kayıtlı dinleyici yok (type=${record.type}); ` +
          `event adı değişmiş veya modülün aboneliği kurulmamış olabilir.`
      );
      return;
    }

    try {
      await this.eventEmitter.emitAsync(record.type, record.payload);
      await this.outboxRepo.markProcessed(record.id);
    } catch (error) {
      await this.fail(
        record,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Teslim edilemeyen kaydı işaretler ve **görünür** kılar. Deneme hakkı bitince
   * kayıt ölü mektuba düşer: yayın durur (aynı event'in başarılı dinleyicilerini
   * sonsuza kadar tekrar tetiklemesin), kayıt silinmez ve CRITICAL uyarı çıkar.
   */
  private async fail(
    record: ClaimedOutboxRecord,
    errorMessage: string
  ): Promise<void> {
    const deadLetter = OutboxRepository.isExhausted(record.attempts);

    this.logger.error(
      `Outbox kaydı teslim edilemedi: id=${record.id} type=${record.type} ` +
        `deneme=${record.attempts}/${OUTBOX_MAX_ATTEMPTS}${
          deadLetter ? ' (ölü mektup)' : ''
        } — ${errorMessage}`
    );

    try {
      await this.outboxRepo.markFailed({
        id: record.id,
        error: errorMessage,
        deadLetter,
      });
    } catch (error) {
      // İşaretleme de başarısızsa kayıt açık kalır: kiralama süresi dolunca
      // yeniden denenir. Kaybolmaz, yalnız sebebi yazılamamış olur.
      this.logger.error(
        `Outbox kaydının hata damgası yazılamadı: id=${record.id}`,
        error
      );
    }

    this.criticalFailure.publish({
      operation: 'outbox.deliver',
      severity: deadLetter ? 'CRITICAL' : 'WARNING',
      summary: deadLetter
        ? `Outbox kaydı ${OUTBOX_MAX_ATTEMPTS} denemede teslim edilemedi; ` +
          `ölü mektuba düştü ve artık denenmiyor.`
        : 'Outbox kaydı teslim edilemedi; kiralama süresi dolunca yeniden denenecek.',
      errorMessage,
      context: {
        outboxId: record.id,
        eventType: record.type,
        attempts: record.attempts,
      },
      clinicId: null,
      dedupeKey: deadLetter
        ? `outbox-dead-letter:${record.id}`
        : `outbox-delivery-failed:${record.id}`,
    });
  }
}
