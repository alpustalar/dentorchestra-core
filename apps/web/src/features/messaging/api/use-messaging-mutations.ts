'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messagingEndpoints, type SendMessage } from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import { messagingKeys } from './messaging.keys';

interface ConversationContext {
  clinicId: string;
  conversationId: string;
}

/**
 * Gönderim sonrası hem mesajlar hem konuşma listesi tazelenir: liste satırı son
 * mesaj zamanını ve okunmamış sayacını taşıyor, yalnız mesajları tazelemek
 * gelen kutusunu eski gösterirdi.
 */
export function useSendMessage({
  clinicId,
  conversationId,
}: ConversationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessage) =>
      api(messagingEndpoints.sendMessage, {
        params: { clinicId, conversationId },
        body: data,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: messagingKeys.messages(clinicId, conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: messagingKeys.conversations(clinicId),
        }),
      ]);
    },
  });
}

/**
 * Okundu işaretleme. Konuşma açıldığında tetiklenir; sayaç sıfırlandığı için
 * yalnız **liste** tazelenir — mesajların kendisi değişmez.
 */
export function useMarkConversationRead({
  clinicId,
  conversationId,
}: ConversationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api(messagingEndpoints.markRead, {
        params: { clinicId, conversationId },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(clinicId),
      }),
  });
}

export function useCloseConversation({
  clinicId,
  conversationId,
}: ConversationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api(messagingEndpoints.close, {
        params: { clinicId, conversationId },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(clinicId),
      }),
  });
}

export function useAssignConversation({
  clinicId,
  conversationId,
}: ConversationContext) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (assigneeUserId: string) =>
      api(messagingEndpoints.assign, {
        params: { clinicId, conversationId },
        body: { assigneeUserId },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: messagingKeys.conversations(clinicId),
      }),
  });
}
