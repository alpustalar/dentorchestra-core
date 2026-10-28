import type { GetConversations, PaginationInput } from '@dentorchestra/shared/client';

/**
 * Mesaj listesi konuşmanın **altında** duruyor: bir mesaj gönderildiğinde hem o
 * konuşmanın mesajları hem konuşma listesi (son mesaj zamanı, okunmamış sayacı)
 * tazelenmeli. Hiyerarşi bunu tek `invalidate` çağrısına indiriyor.
 */
export const messagingKeys = {
  all: ['messaging'] as const,

  conversations: (clinicId: string) =>
    [...messagingKeys.all, 'conversations', clinicId] as const,

  conversationList: (
    clinicId: string,
    filter: GetConversations | undefined,
    pagination: PaginationInput | undefined
  ) =>
    [...messagingKeys.conversations(clinicId), { filter, pagination }] as const,

  messages: (clinicId: string, conversationId: string) =>
    [...messagingKeys.all, 'messages', clinicId, conversationId] as const,

  messageList: (
    clinicId: string,
    conversationId: string,
    pagination: PaginationInput | undefined
  ) =>
    [...messagingKeys.messages(clinicId, conversationId), { pagination }] as const,
};
