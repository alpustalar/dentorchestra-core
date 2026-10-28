'use client';

import type { ConversationResponse } from '@dentorchestra/shared/client';
import dayjs from 'dayjs';

import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { CHANNEL_LABELS } from '../messaging.labels';

interface ConversationListProps {
  conversations: ConversationResponse[];
  isLoading: boolean;
  activeId: string | undefined;
  onSelect: (conversationId: string) => void;
}

export function ConversationList({
  conversations,
  isLoading,
  activeId,
  onSelect,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Bu filtrelerle konuşma bulunamadı.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            type="button"
            onClick={() => onSelect(conversation.id)}
            aria-current={conversation.id === activeId ? 'true' : undefined}
            className={cn(
              'hover:bg-muted/50 w-full px-3 py-3 text-left',
              conversation.id === activeId && 'bg-muted'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">
                {/* Instagram'da telefon yok — kişi adı da yoksa konuşma
                    kimliksiz kalmasın diye kanal adına düşülür. */}
                {conversation.contactName ??
                  conversation.contactPhone ??
                  CHANNEL_LABELS[conversation.channel]}
              </span>

              {conversation.unreadCount > 0 && (
                <Badge variant="default">{conversation.unreadCount}</Badge>
              )}
            </div>

            <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
              <span>{CHANNEL_LABELS[conversation.channel]}</span>
              {conversation.lastMessageAt && (
                <span>
                  {dayjs(conversation.lastMessageAt).format('DD.MM HH:mm')}
                </span>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
