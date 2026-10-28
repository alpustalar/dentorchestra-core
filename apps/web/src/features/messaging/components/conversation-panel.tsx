'use client';

import { useEffect } from 'react';
import type { ConversationResponse } from '@dentorchestra/shared/client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

import { useConversationMessages } from '../api/use-conversation-messages';
import {
  useCloseConversation,
  useMarkConversationRead,
} from '../api/use-messaging-mutations';
import {
  CHANNEL_LABELS,
  CONVERSATION_STATUS_LABELS,
} from '../messaging.labels';
import { MessageComposer } from './message-composer';
import { MessageThread } from './message-thread';

interface ConversationPanelProps {
  clinicId: string;
  conversation: ConversationResponse;
}

export function ConversationPanel({
  clinicId,
  conversation,
}: ConversationPanelProps) {
  const messages = useConversationMessages({
    clinicId,
    conversationId: conversation.id,
  });

  const markRead = useMarkConversationRead({
    clinicId,
    conversationId: conversation.id,
  });
  const closeConversation = useCloseConversation({
    clinicId,
    conversationId: conversation.id,
  });

  const { mutate: markReadMutate } = markRead;
  const hasUnread = conversation.unreadCount > 0;

  /*
   * Konuşma açıldığında okundu işaretlenir. Bağımlılıklar bilerek dar:
   * `conversation.id` + okunmamış olup olmadığı. Nesnenin tamamına bağlansaydı
   * her 30 sn'lik tazelemede yeni referans gelir ve okundu isteği tekrar tekrar
   * atılırdı.
   */
  useEffect(() => {
    if (hasUnread) markReadMutate();
  }, [conversation.id, hasUnread, markReadMutate]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">
            {conversation.contactName ??
              conversation.contactPhone ??
              CHANNEL_LABELS[conversation.channel]}
          </h2>
          <p className="text-muted-foreground text-xs">
            {CHANNEL_LABELS[conversation.channel]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {CONVERSATION_STATUS_LABELS[conversation.status]}
          </Badge>

          {conversation.status !== 'CLOSED' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => closeConversation.mutate()}
              disabled={closeConversation.isPending}
            >
              Kapat
            </Button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {messages.error ? (
          <p role="alert" className="text-destructive p-4 text-sm">
            {messages.error instanceof ApiError
              ? messages.error.message
              : 'Mesajlar yüklenemedi.'}
          </p>
        ) : (
          <MessageThread
            messages={messages.data?.data ?? []}
            isLoading={messages.isPending}
          />
        )}
      </div>

      <MessageComposer clinicId={clinicId} conversation={conversation} />
    </div>
  );
}
