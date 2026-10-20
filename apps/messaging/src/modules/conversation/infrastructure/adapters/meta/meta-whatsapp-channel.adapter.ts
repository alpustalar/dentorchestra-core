import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel, MessageType } from '@shared';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetWhatsappChannelCredentialsQuery } from '@modules/channel-config/application/queries/get-whatsapp-channel-credentials/get-whatsapp-channel-credentials.query';
import { WhatsappChannelCredentials } from '@modules/channel-config/application/queries/get-whatsapp-channel-credentials/get-whatsapp-channel-credentials.response';
import {
  MessageChannelPort,
  SendMessageRequest,
  SendMessageResult,
} from '@modules/conversation/domain/ports/message-channel.port';
import {
  WHATSAPP_GRAPH_API_BASE,
  WHATSAPP_SEND_TIMEOUT_MS,
} from './whatsapp-graph.constants';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

interface GraphSendResponse {
  messages?: Array<{ id: string }>;
  error?: { message?: string; code?: number; error_data?: unknown };
}

/**
 * Gerçek WhatsApp Cloud API (Meta Graph API) gönderim adapter'ı. Klinik credential'ını
 * (phoneNumberId + decrypted accessToken) internal query üzerinden çözer, Graph API
 * `/{phoneNumberId}/messages` endpoint'ine POST atar ve dönen WhatsApp mesaj id'sini
 * externalId olarak verir. Hata → fırlatır (çağıran/kuyruk retry/FAILED yönetir).
 */
@Injectable()
export class MetaWhatsappChannelAdapter implements MessageChannelPort {
  private readonly logger = new Logger(MetaWhatsappChannelAdapter.name);

  constructor(private readonly queryBus: TSQueryBus) {}

  async send(request: SendMessageRequest): Promise<SendMessageResult> {
    const { data: credentials } = await this.queryBus.execute(
      new GetWhatsappChannelCredentialsQuery(request.clinicId)
    );
    if (!credentials) {
      throw new Error(
        `WhatsApp credential'ı yok/pasif: clinicId=${request.clinicId}`
      );
    }
    if (
      credentials.tokenExpiresAt &&
      credentials.tokenExpiresAt <= DateTimeManager.create()
    ) {
      throw new Error(
        `WhatsApp token süresi dolmuş, yeniden bağlanın (reconnect): clinicId=${request.clinicId}`
      );
    }

    const payload = this.buildPayload(request);
    return this.post(credentials, payload);
  }

  async markRead(
    _channel: MessageChannel,
    clinicId: string,
    externalMessageId: string
  ): Promise<void> {
    const { data: credentials } = await this.queryBus.execute(
      new GetWhatsappChannelCredentialsQuery(clinicId)
    );
    if (!credentials) return; // kanal pasif/yok — sessizce geç (best-effort)

    const url = `${WHATSAPP_GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: externalMessageId,
      }),
      signal: AbortSignal.timeout(WHATSAPP_SEND_TIMEOUT_MS),
    });
    if (!res.ok) {
      const reason = await res.text().catch(() => `HTTP ${res.status}`);
      // Best-effort: okundu işareti başarısızlığı çağıranı bloklamamalı.
      this.logger.warn(`WhatsApp okundu işareti hatası: ${reason}`);
    }
  }

  /** WhatsApp Cloud API mesaj gövdesini mesaj tipine göre kurar. */
  private buildPayload(request: SendMessageRequest): Record<string, unknown> {
    const base = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: request.toPhone,
    };

    switch (request.type) {
      case MessageType.TEXT:
        return {
          ...base,
          type: 'text',
          text: { preview_url: false, body: request.body ?? '' },
        };
      case MessageType.MEDIA: {
        // Alt-tipe göre doğru medya objesi (image/document/video/audio/sticker).
        // Caption yalnızca image/video/document'ta desteklenir.
        const mediaType = request.mediaType ?? 'image';
        const supportsCaption =
          mediaType === 'image' ||
          mediaType === 'video' ||
          mediaType === 'document';
        const media: Record<string, unknown> = { link: request.mediaUrl };
        if (supportsCaption && request.body) media.caption = request.body;
        return { ...base, type: mediaType, [mediaType]: media };
      }
      case MessageType.TEMPLATE: {
        if (!request.template) {
          throw new Error('TEMPLATE gönderimi için template alanı zorunlu.');
        }
        const components = this.buildTemplateComponents(request.template);
        return {
          ...base,
          type: 'template',
          template: {
            name: request.template.name,
            language: { code: request.template.language },
            ...(components.length > 0 ? { components } : {}),
          },
        };
      }
      default:
        throw new Error(`Desteklenmeyen mesaj tipi: ${request.type}`);
    }
  }

  /** Şablon header/body/buton component'lerini WhatsApp Cloud API formatına çevirir. */
  private buildTemplateComponents(
    template: NonNullable<SendMessageRequest['template']>
  ): Array<Record<string, unknown>> {
    const components: Array<Record<string, unknown>> = [];

    // Header — text veya media (image/video/document).
    if (template.headerText) {
      components.push({
        type: 'header',
        parameters: [{ type: 'text', text: template.headerText }],
      });
    } else if (template.headerMediaUrl && template.headerMediaType) {
      components.push({
        type: 'header',
        parameters: [
          {
            type: template.headerMediaType,
            [template.headerMediaType]: { link: template.headerMediaUrl },
          },
        ],
      });
    }

    // Body — sıralı metin değişkenleri.
    if (template.bodyParams.length > 0) {
      components.push({
        type: 'body',
        parameters: template.bodyParams.map((text) => ({
          type: 'text',
          text,
        })),
      });
    }

    // Buttons — dinamik URL suffix'leri (buton index sırasına göre).
    (template.urlButtonParams ?? []).forEach((text, index) => {
      components.push({
        type: 'button',
        sub_type: 'url',
        index: String(index),
        parameters: [{ type: 'text', text }],
      });
    });

    return components;
  }

  private async post(
    credentials: WhatsappChannelCredentials,
    payload: Record<string, unknown>
  ): Promise<SendMessageResult> {
    const url = `${WHATSAPP_GRAPH_API_BASE}/${credentials.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(WHATSAPP_SEND_TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => ({}))) as GraphSendResponse;

    if (!res.ok || !json.messages?.[0]?.id) {
      const reason = json.error?.message ?? `HTTP ${res.status}`;
      this.logger.error(`WhatsApp gönderim hatası: ${reason}`);
      throw new Error(`WhatsApp gönderim hatası: ${reason}`);
    }

    return { externalId: json.messages[0].id };
  }
}
