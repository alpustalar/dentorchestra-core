import { Injectable, Logger } from '@nestjs/common';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { MessageReceivedEvent } from '@modules/conversation/domain/events/message-received.event';
import { GetAiAgentRuntimeConfigQuery } from '@modules/ai-agent/application/queries/get-ai-agent-runtime-config/get-ai-agent-runtime-config.query';
import { AiReplyProducer } from '../../queue/producers/ai-reply.producer';
import { OnDomainEvent } from '@common/decorators';

/**
 * Gelen (inbound) mesaj event'ine abone olur ve kliniğin AI asistanı etkinse yanıt üretimini
 * MESSAGING_AI kuyruğuna alır. Etkin olmayan klinikler için kuyruk şişmesini önlemek üzere
 * hafif bir enabled kontrolü yapılır; tüm guard'lar (pencere/atama/opt-out) processor'da
 * tekrar uygulanır. Hata inbound akışını bloklamaz (best-effort).
 */
@Injectable()
export class AiReplyListener {
  private readonly logger = new Logger(AiReplyListener.name);

  constructor(
    private readonly queryBus: TSQueryBus,
    private readonly aiReplyProducer: AiReplyProducer
  ) {}

  @OnDomainEvent(MessageReceivedEvent.NAME)
  async handle(event: MessageReceivedEvent): Promise<void> {
    try {
      const { data: config } = await this.queryBus.execute(
        new GetAiAgentRuntimeConfigQuery(event.clinicId)
      );
      if (!config || !config.isEnabled) return;

      await this.aiReplyProducer.enqueueReply({
        conversationId: event.conversationId,
        messageId: event.messageId,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Bilinmeyen hata';
      this.logger.warn(
        `AI yanıtı kuyruğa alınamadı (conversationId=${event.conversationId}): ${reason}`
      );
    }
  }
}
