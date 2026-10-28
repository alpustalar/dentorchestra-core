'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  messagingEndpoints,
  type PaginationInput,
} from '@dentorchestra/shared/client';

import { apiWithMeta } from '@/lib/api';

import { messagingKeys } from './messaging.keys';

interface UseConversationMessagesParams {
  clinicId: string;
  conversationId: string | undefined;
  pagination?: PaginationInput;
}

/** Seçili konuşmanın mesajları. Konuşma seçili değilken sorgu hiç atılmaz. */
export function useConversationMessages({
  clinicId,
  conversationId,
  pagination,
}: UseConversationMessagesParams) {
  return useQuery({
    queryKey: messagingKeys.messageList(
      clinicId,
      conversationId ?? '',
      pagination
    ),
    queryFn: ({ signal }) =>
      apiWithMeta(messagingEndpoints.messages, {
        params: { clinicId, conversationId: conversationId as string },
        pagination,
        signal,
      }),
    enabled: Boolean(conversationId),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
}
