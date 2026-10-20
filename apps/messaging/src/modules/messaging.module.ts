import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { WhatsappChannelPresentationModule } from './channel-config/presentation/controllers/whatsapp-channel.presentation.module';
import { TelegramChannelPresentationModule } from './channel-config/presentation/controllers/telegram-channel.presentation.module';
import { InstagramChannelPresentationModule } from './channel-config/presentation/controllers/instagram-channel.presentation.module';
import { ConversationPresentationModule } from './conversation/presentation/controllers/conversation.presentation.module';
import { AiAgentPresentationModule } from './ai-agent/presentation/ai-agent.presentation.module';
import { AiReplyModule } from './ai-agent/infrastructure/ai-reply.module';

/**
 * Messaging bounded-context: çok kanallı (WhatsApp + Telegram + Instagram) yazışma.
 * Alt-bağlamlar: channel-config (klinik WhatsApp/Telegram/Instagram satellite'leri) +
 * conversation (kanal-bağımsız çekirdek + webhook'lar) + ai-agent (klinik başına AI sohbet
 * asistanı). Kanal gönderimi soyut MessageChannelPort + ChannelRouterAdapter üzerinden; AI
 * yanıtı MessageReceivedEvent'e abone olup kuyruğa düşer.
 *
 * Tüm HTTP rotaları `messaging` öneki altında toplanır — böylece ters vekilde
 * tek bir yol kuralı (`/api/v1/messaging/*` → 8081) bu servisin tamamını
 * karşılar; kanal eklendikçe vekil kuralına dokunmak gerekmez.
 *
 * Önek `children` ile veriliyor, `{ path, module: MessagingModule }` ile DEĞİL:
 * RouterModule yolu modül sınıfının metadata'sına yazar ve bu, o modülün
 * `controllers`'ına uygulanır. `MessagingModule` yalnız alt modül import ettiği
 * için tek başına `module:` yazımı sessizce etkisiz kalıyordu (ayrımdan önce de
 * öyleydi — rotalar `messaging` öneki olmadan yayınlanıyordu).
 */

@Module({
  imports: [
    RouterModule.register([
      {
        path: 'messaging',
        children: [
          WhatsappChannelPresentationModule,
          TelegramChannelPresentationModule,
          InstagramChannelPresentationModule,
          ConversationPresentationModule,
          AiAgentPresentationModule,
        ],
      },
    ]),
    WhatsappChannelPresentationModule,
    TelegramChannelPresentationModule,
    InstagramChannelPresentationModule,
    ConversationPresentationModule,
    AiAgentPresentationModule,
    AiReplyModule,
  ],
})
export class MessagingModule {}
