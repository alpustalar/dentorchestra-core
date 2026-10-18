import { ReceiveInboundMessageCommand } from '@modules/conversation/application/commands/receive-inbound-message/receive-inbound-message.command';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import {
  CONVERSATION_COMMAND_REPOSITORY,
  IConversationCommandRepository,
} from '@modules/conversation/domain/repositories/conversation.repository';
import {
  IMessageCommandRepository,
  MESSAGE_COMMAND_REPOSITORY,
} from '@modules/conversation/domain/repositories/message.repository';
import { MongoTransactionManager } from '@src/infrastructure/persistence/mongo/mongo-transaction.manager';
import { Message } from '@modules/conversation/domain/entities/message.entity';
import {
  detectOptIntent,
  OptIntentSchema,
} from '@modules/conversation/domain/marketing-opt-out';
import { Conversation } from '@modules/conversation/domain/entities/conversation.entity';
import { MessageChannelSchema } from '@shared';
import { MessageChannel } from '@shared';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  CONTACT_RESOLVER_PORT,
  IContactResolverPort,
} from '@modules/conversation/domain/ports/contact-resolver.port';
import {
  IMessagingCacheService,
  MESSAGING_CACHE_SERVICE,
} from '@modules/conversation/domain/interfaces/messaging-cache.service.interface';
import {
  AI_MEMORY_CACHE_SERVICE,
  IAiMemoryCacheService,
} from '@modules/ai-agent/domain/interfaces/ai-memory-cache.service.interface';

@CommandHandler(ReceiveInboundMessageCommand)
export class ReceiveInboundMessageHandler implements ICommandHandler<
  ReceiveInboundMessageCommand,
  string
> {
  private readonly logger = new Logger(ReceiveInboundMessageHandler.name);

  constructor(
    @Inject(CONVERSATION_COMMAND_REPOSITORY)
    private readonly conversationRepo: IConversationCommandRepository,
    @Inject(MESSAGE_COMMAND_REPOSITORY)
    private readonly messageRepo: IMessageCommandRepository,
    @Inject(MESSAGING_CACHE_SERVICE)
    private readonly messagingCache: IMessagingCacheService,
    @Inject(AI_MEMORY_CACHE_SERVICE)
    private readonly aiMemoryCache: IAiMemoryCacheService,
    @Inject(CONTACT_RESOLVER_PORT)
    private readonly contactResolver: IContactResolverPort,
    private readonly txManager: MongoTransactionManager
  ) {}

  async execute(command: ReceiveInboundMessageCommand): Promise<string> {
    const { input } = command;
    const channel = input.channel ?? MessageChannelSchema.enum.WHATSAPP;

    // idempotemcy check meta aynı mesajı tekrar iletebiliyor. Bu okuma yazıp
    // yazmayacağımıza karar verdiği için command repo'dan (ana bağlantı) yapılır —
    // replica gecikmesi mükerrer kayıt üretirdi. Yarışın son güvencesi yine de
    // `@@unique(externalId)` kısıtıdır.
    const existingMessage = await this.messageRepo.findByExternalId(
      input.externalId
    );
    if (existingMessage) return existingMessage.id;

    // Yukarıdaki ön-kontrol yalnız SIRAYLA gelen mükerrer teslimi eler. Meta aynı
    // webhook'u paralel de gönderebiliyor; o durumda iki istek de kontrolü geçip
    // biri unique ihlaliyle patlar (ve Meta'ya 500 döner → yeniden teslim). Redis
    // kilidi bu yarış penceresini kapatır: kilidi alamayan sessizce çekilir.
    const lockHolderId = UUID.generate().value;
    const lock = await this.messagingCache.inboundDedup.acquire({
      channel,
      externalId: input.externalId,
      holderId: lockHolderId,
    });
    if (lock.status === 'duplicate') {
      this.logger.debug(
        `Mükerrer webhook teslimi atlandı: ${channel}/${input.externalId}`
      );
      // Kilidi kazanan taraf bu arada commit etmiş olabilir; etmişse gerçek id'yi
      // döndür. Hâlâ uçuştaysa döndürecek bir id yok — webhook zaten sonucu
      // kullanmıyor, Meta'ya 200 dönmesi yeterli.
      const winner = await this.messageRepo.findByExternalId(
        input.externalId
      );
      return winner?.id ?? '';
    }

    try {
      return await this.persist(command);
    } catch (err) {
      // İşleme başarısız → kilidi bırak ki Meta'nın yeniden teslimi işlenebilsin.
      // Başarıda kilit bilinçli olarak TTL boyunca dedup işareti şeklinde kalır.
      await this.messagingCache.inboundDedup.release({
        channel,
        externalId: input.externalId,
        holderId: lockHolderId,
      });
      throw err;
    }
  }

  private async persist(
    command: ReceiveInboundMessageCommand
  ): Promise<string> {
    const { input } = command;
    const channel = input.channel ?? MessageChannelSchema.enum.WHATSAPP;

    const patientId = await this.contactResolver.findPatientId({
      clinicId: input.clinicId,
      channel,
      contactPhone: input.contactPhone,
      matchPhone: input.matchPhone,
    });

    const saved = await this.txManager.outboxRun(async () => {
      // resolveConversation ctx içinde çalışıp mükerrerliği engellemeli
      const { conversation, isNew } = await this.resolveConversation(
        command,
        patientId
      );

      // Mevcut (misafir) yazışma sonradan tanınırsa hastaya bağla — yalnız boşken doldur.
      if (patientId && !conversation.patientId) {
        conversation.linkContact({ patientId });
      }

      // Reklamdan (Click-to-Chat) gelen YENİ misafir yazışması → attribution'lı Lead üret
      // ve yazışmaya bağla. recordInboundMessage'dan önce set edilir ki event leadId taşısın.
      if (isNew && !patientId && input.referral?.medium === 'AD') {
        const leadId = await this.contactResolver.registerAdReferralLead({
          clinicId: input.clinicId,
          organizationId: input.organizationId,
          channel,
          contactPhone: input.contactPhone,
          contactName: input.contactName,
          referral: {
            adId: input.referral.adId ?? null,
            ctwaClid: input.referral.ctwaClid ?? null,
            sourceUrl: input.referral.sourceUrl ?? null,
          },
        });
        if (leadId) conversation.linkContact({ leadId });
      }

      const message = Message.createInbound({
        conversationId: conversation.id,
        body: input.body,
        mediaUrl: input.mediaUrl,
        type: input.type,
        externalId: input.externalId,
        payload: input.payload,
        replyToExternalId: input.replyToExternalId,
      });

      const savedMessage = await this.messageRepo.create(message);

      conversation.recordInboundMessage({
        messageId: savedMessage.id,
        body: input.body ?? null,
        occurredAt: input.occurredAt,
      });

      // Pazarlama yönelimi kontrolü
      const intent = detectOptIntent(input.body);
      if (intent === OptIntentSchema.enum.opt_out)
        conversation.optOutMarketing();
      else if (intent === OptIntentSchema.enum.opt_in)
        conversation.resumeMarketing();

      // Yeni yazışma INSERT, mevcut olan UPDATE.
      if (isNew) {
        await this.conversationRepo.create(conversation);
      } else {
        await this.conversationRepo.update(conversation);
      }

      // Bağlam penceresini tazele — AI turu bu mesajı DB'ye gitmeden görsün. Cache
      // otoritatif değil; `append` pencere soğuksa no-op'tur ve okuma DB'den ısıtır.
      //
      // **Neden transaction'ın İÇİNDE (en sonda):** event bu bloğun commit'inde
      // mühürlenir ve relay hemen dürtülür; append commit'ten sonra yapılırsa AI turu
      // pencereyi **bu mesaj olmadan** okur ve geç gelen append önceki kullanıcı
      // turunu tekrarlar (ölçüldü: ikinci turun penceresi `[user A, assistant, user A]`
      // oluyordu). Eskiden sıra tesadüfen tutuyordu: dinleyiciler `emitAsync` ile
      // beklenmediği için handler her zaman önde bitiyordu. Teslim gerçek olunca
      // tesadüf bozuldu — doğruluk zamanlamaya bırakılamaz. Rollback penceresi
      // yalnız commit hatasıdır; pencere TTL'li ve otoritatif değil.
      const body = input.body?.trim();
      if (body) {
        await this.aiMemoryCache.append({
          conversationId: conversation.id,
          message: { role: 'user', content: body },
        });
      }

      return { messageId: savedMessage.id, conversationId: conversation.id };
    });

    return saved.messageId;
  }

  // var olan yazışmayı bul yoksa kilit altında yeni yazışma başlat

  private async resolveConversation(
    command: ReceiveInboundMessageCommand,
    patientId: string | null
  ): Promise<{ conversation: Conversation; isNew: boolean }> {
    const { input } = command;

    const channel = input.channel ?? MessageChannelSchema.enum.WHATSAPP;

    // Kilitli okuma: `recordInboundMessage` unreadCount'u okuyup artırdığı için, aynı
    // kontaktan arka arkaya gelen iki mesaj kilitsizken aynı sayıyı okuyup birbirini
    // ezerdi. Yazışma yoksa kilitlenecek satır yok; mükerrerliği @@unique engeller.
    const existing = await this.conversationRepo.findByContactForUpdate({
      clinicId: input.clinicId,
      channel,
      contactPhone: input.contactPhone,
    });

    if (existing) return { conversation: existing, isNew: false };

    return {
      conversation: Conversation.start({
        clinicId: input.clinicId,
        organizationId: input.organizationId,
        channel,
        contactPhone: input.contactPhone,
        contactName: input.contactName,
        patientId: patientId,
      }),
      isNew: true,
    };
  }
}
