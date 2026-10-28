'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type {
  ConversationStatusValue,
  GetConversations,
  PaginationInput,
} from '@dentorchestra/shared/client';

const PAGE_SIZE = 30;

export interface InboxParams {
  filter: GetConversations;
  pagination: PaginationInput;
  /** Sağ panelde açık olan konuşma; URL'de taşınır ki bağlantı paylaşılabilsin. */
  conversationId: string | undefined;
}

export function useInboxParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<InboxParams>(() => {
    const status = searchParams.get('status');
    const page = Number(searchParams.get('page') ?? '1');

    return {
      filter: {
        status: (status as ConversationStatusValue | null) ?? undefined,
        assignedUserId: searchParams.get('assignedUserId') ?? undefined,
      },
      pagination: {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: PAGE_SIZE,
      },
      conversationId: searchParams.get('conversationId') ?? undefined,
    };
  }, [searchParams]);

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());

      if (value) next.set(key, value);
      else next.delete(key);

      // Filtre değişince sayfa başa döner. Seçili konuşma da düşer: filtre
      // daraltıldığında sağ panelde artık listede olmayan bir konuşma kalırdı.
      if (key !== 'page' && key !== 'conversationId') {
        next.delete('page');
        next.delete('conversationId');
      }

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { ...params, setParam };
}
