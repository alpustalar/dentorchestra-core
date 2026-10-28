import type {
  ConversationStatusValue,
  MessageChannelValue,
  MessageStatusValue,
} from '@dentorchestra/shared/client';

export const CHANNEL_LABELS: Record<MessageChannelValue, string> = {
  WHATSAPP: 'WhatsApp',
  TELEGRAM: 'Telegram',
  INSTAGRAM: 'Instagram',
};

export const CONVERSATION_STATUS_LABELS: Record<
  ConversationStatusValue,
  string
> = {
  OPEN: 'Açık',
  PENDING: 'Bekliyor',
  CLOSED: 'Kapalı',
};

/**
 * Giden mesajın teslim durumu. `FAILED` dışındakiler ilerleyen bir zincir
 * (kuyruk → gönderildi → iletildi → okundu); arayüz bunu tek satırda gösterir.
 */
export const MESSAGE_STATUS_LABELS: Record<MessageStatusValue, string> = {
  RECEIVED: 'Alındı',
  QUEUED: 'Kuyrukta',
  SENT: 'Gönderildi',
  DELIVERED: 'İletildi',
  READ: 'Okundu',
  FAILED: 'Başarısız',
};
