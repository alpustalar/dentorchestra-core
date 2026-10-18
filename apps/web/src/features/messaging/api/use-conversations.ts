'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type GetConversations,
  messagingEndpoints,
  type PaginationInput,
} from '@core-crm/shared/client';

import { apiWithMeta } from '@/lib/api';

import { messagingKeys } from './messaging.keys';

interface UseConversationsParams {
  clinicId: string;
  filter?: GetConversations;
  pagination?: PaginationInput;
}

/**
 * Gelen kutusu. Gerçek zamanlı taşıma (websocket/SSE) yok — bu yüzden pencere
 * odağa geldiğinde ve düzenli aralıkla tazeleniyor. Aralık kısa tutulmadı:
 * gelen kutusu açıkken sürekli istek atmak sunucuya yük, kullanıcıya da fark
 * ettirmeden pil/veri harcatır.
 */
export function useConversations({
  clinicId,
  filter,
  pagination,
}: UseConversationsParams) {
  return useQuery({
    queryKey: messagingKeys.conversationList(clinicId, filter, pagination),
    queryFn: ({ signal }) =>
      apiWithMeta(messagingEndpoints.conversations, {
        params: { clinicId },
        query: filter,
        pagination,
        signal,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
