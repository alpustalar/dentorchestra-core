import { DelayedError, Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { MessageStatus, MessageType } from '@shared';
import { QUEUES } from '@common/constants';
import {
  MESSAGING_DELIVERY_RETRY_BUFFER_MS,
  MESSAGING_JOBS,
  MESSAGING_SEND_MAX_ATTEMPTS,
  MESSAGING_SEND_RATE_DURATION_MS,
  MESSAGING_SEND_RATE_MAX,
} from '@messaging/constants/jobs.constant';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IMessagingCacheService,
  MESSAGING_CACHE_SERVICE,
} from '@modules/conversation/domain/interfaces/messaging-cache.service.interface';
import { Message } from '@modules/conversation/domain/entities/message.entity';
import { Conversation } from '@modules/conversation/domain/entities/conversation.entity';
import { MongoTransactionManager } from '@src/infrastructure/persistence/mongo/mongo-transaction.manager';
import {
  MESSAGE_CHANNEL_PORT,
  MessageChannelPort,
} from '@modules/conversation/domain/ports/message-channel.port';
import {
  MESSAGE_COMMAND_REPOSITORY,
  IMessageCommandRepository,
} from '@modules/conversation/domain/repositories/message.repository';
import {
  CONVERSATION_COMMAND_REPOSITORY,
  IConversationCommandRepository,
} from '@modules/conversation/domain/repositories/conversation.repository';

interface SendJobData {
  messageId: string;
}

interface DeliverPayload {
  job: Job<SendJobData>;
  message: Message;
  conversation: Conversation;
}

/**
 * Giden mesaj teslim işleyicisi. QUEUED mesajı yükler, kanal portuna (Meta WhatsApp)
 * iletir; başarıda SENT + son mesaj zamanı güncellenir, hata fırlatılırsa BullMQ retry
 * eder. Son denemede de başarısızsa mesaj FAILED işaretlenir (dead-letter kalır).
 *
 * Gönderim öncesi iki Redis kapısı vardır (ikisi de job'u ERTELER, hata saymaz):
 * yazışma başına mutex (mesaj sırası korunur) ve klinik başına kota (WhatsApp
 * limitleri numara bazlı; worker-geneli limiter tek kliniğin kotayı yemesini önleyemez).
 */
@Processor(QUEUES.MESSAGING, {
  limiter: {
    max: MESSAGING_SEND_RATE_MAX,
    duration: MESSAGING_SEND_RATE_DURATION_MS,
  },
})
export class MessageDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageDeliveryProcessor.name);

  constructor(
    @Inject(MESSAGE_CHANNEL_PORT)
    private readonly channel: MessageChannelPort,
    @Inject(MESSAGE_COMMAND_REPOSITORY)
    private readonly messageCommandRepo: IMessageCommandRepository,
    @Inject(CONVERSATION_COMMAND_REPOSITORY)
    private readonly conversationCommandRepo: IConversationCommandRepository,
    @Inject(MESSAGING_CACHE_SERVICE)
    private readonly messagingCache: IMessagingCacheService,
    private readonly txManager: MongoTransactionManager
  ) {
    super();
  }

  async process(job: Job<SendJobData>, token?: string): Promise<void> {
    switch (job.name) {
      case MESSAGING_JOBS.SEND_MESSAGE:
        await this.handleSend(job, token);
        break;
      default:
        this.logger.warn(`Bilinmeyen messaging job'u: ${job.name}`);
    }
  }

  private async handleSend(
    job: Job<SendJobData>,
    token?: string
  ): Promise<void> {
    // Gönderim kararını besleyen okuma command repo'dan (ana bağlantı): replica
    // gecikmesi, webhook'un çoktan SENT işaretlediği mesajı tekrar göndertebilirdi.
    const message = await this.messageCommandRepo.findById(job.data.messageId);
    if (!message) {
      this.logger.warn(`Mesaj bulunamadı, atlanıyor: ${job.data.messageId}`);
      return;
    }
    // Idempotency: yalnızca QUEUED mesaj gönderilir (SENT/FAILED tekrar işlenmez).
    if (message.status !== MessageStatus.QUEUED) return;

    const conversation = await this.conversationCommandRepo.findById(
      message.conversationId
    );
    if (!conversation) {
      this.logger.warn(
        `Yazışma bulunamadı, mesaj atlanıyor: ${message.conversationId}`
      );
      return;
    }

    // Kapı 1 — yazışma mutex'i. Kuyruk eşzamanlılığı > 1 olduğunda aynı yazışmanın iki
    // mesajı paralel uçup kanala ters sırada varabilir; mutex sırayı korur.
    const lockHolderId = UUID.generate().value;
    const lock = await this.messagingCache.deliveryLock.acquire({
      conversationId: conversation.id,
      holderId: lockHolderId,
    });
    if (lock.status === 'busy') {
      return this.delayJob(job, lock.retryAfterMs, token);
    }

    try {
      // Kapı 2 — klinik (numara) başına gönderim kotası.
      const quota = await this.messagingCache.sendQuota.consume({
        clinicId: conversation.clinicId,
      });
      if (quota.status === 'throttled') {
        return await this.delayJob(job, quota.retryAfterMs, token);
      }

      await this.deliver({ job, message, conversation });
    } finally {
      await this.messagingCache.deliveryLock.release({
        conversationId: conversation.id,
        holderId: lockHolderId,
      });
    }
  }

  /**
   * Job'u ertelenmiş duruma taşır. `moveToDelayed` + `DelayedError` yolu job'un deneme
   * hakkını (attempts) harcamaz — kota/sıra beklemesi bir teslim hatası değildir.
   */
  private async delayJob(
    job: Job<SendJobData>,
    retryAfterMs: number,
    token?: string
  ): Promise<never> {
    const resumeAt =
      DateTimeManager.epochMs() +
      retryAfterMs +
      MESSAGING_DELIVERY_RETRY_BUFFER_MS;

    await job.moveToDelayed(resumeAt, token);
    // BullMQ, job'un işlenmediğini bu hatadan anlar (fail sayılmaz).
    throw new DelayedError();
  }

  private async deliver({
    job,
    message,
    conversation,
  }: DeliverPayload): Promise<void> {
    try {
      const result = await this.channel.send({
        channel: conversation.channel,
        clinicId: conversation.clinicId,
        toPhone: conversation.contactPhone,
        type: message.type,
        body: message.body,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaType,
        template:
          message.type === MessageType.TEMPLATE && message.templateName
            ? {
                name: message.templateName,
                language: message.templateLanguage ?? 'tr',
                bodyParams: message.templateComponents.bodyParams ?? [],
                headerText: message.templateComponents.headerText,
                headerMediaUrl: message.templateComponents.headerMediaUrl,
                headerMediaType: message.templateComponents.headerMediaType,
                urlButtonParams: message.templateComponents.urlButtonParams,
              }
            : undefined,
      });

      // Kanal çağrısı sürerken aynı yazışmaya gelen mesaj düşmüş olabilir. Yukarıdaki
      // (gönderim öncesi) kopyayı geri yazmak o mesajın unreadCount artışını ezerdi —
      // `update()` entity'nin tüm alanlarını yazdığı için. Bu yüzden yazma öncesi
      // ikisi de transaction içinde, kilitli ve taze okunur.
      await this.txManager.run(async () => {
        const fresh = await this.messageCommandRepo.findByIdForUpdate(
          message.id
        );
        if (!fresh) return;

        fresh.markSent(result.externalId);
        await this.messageCommandRepo.update(fresh);

        const freshConversation =
          await this.conversationCommandRepo.findByIdForUpdate(
            message.conversationId
          );
        if (freshConversation) {
          freshConversation.touch();
          await this.conversationCommandRepo.update(freshConversation);
        }
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Gönderim hatası';
      const isFinalAttempt =
        job.attemptsMade + 1 >= MESSAGING_SEND_MAX_ATTEMPTS;

      if (isFinalAttempt) {
        await this.txManager.run(async () => {
          const fresh = await this.messageCommandRepo.findByIdForUpdate(
            message.id
          );
          if (!fresh) return;

          fresh.markFailed(reason);
          await this.messageCommandRepo.update(fresh);
        });
        this.logger.error(
          `Mesaj gönderimi kalıcı başarısız: ${message.id} — ${reason}`
        );
      }
      throw err;
    }
  }
}
