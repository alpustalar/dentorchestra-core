'use client';

import { useEffect, useRef } from 'react';
import type { MessageResponse } from '@dentorchestra/shared/client';
import dayjs from 'dayjs';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { MESSAGE_STATUS_LABELS } from '../messaging.labels';

interface MessageThreadProps {
  messages: MessageResponse[];
  isLoading: boolean;
}

/**
 * Gövdesi olmayan mesaj tipleri (konum, kişi kartı, tepki, desteklenmeyen) için
 * yer tutucu. Boş balon göstermek mesajın hiç gelmediği izlenimi verirdi.
 */
const TYPE_PLACEHOLDERS: Record<string, string> = {
  MEDIA: '[medya]',
  LOCATION: '[konum]',
  CONTACTS: '[kişi kartı]',
  REACTION: '[tepki]',
  INTERACTIVE: '[etkileşimli mesaj]',
  UNSUPPORTED: '[desteklenmeyen mesaj]',
};

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Yeni mesaj geldiğinde en alta kaydır — sohbet ekranının beklenen davranışı.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-2/3" />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Bu konuşmada henüz mesaj yok.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      {messages.map((message) => {
        const isOutbound = message.direction === 'OUTBOUND';
        const text = message.body ?? TYPE_PLACEHOLDERS[message.type] ?? null;

        return (
          <div
            key={message.id}
            className={cn(
              'flex flex-col gap-1',
              isOutbound ? 'items-end' : 'items-start'
            )}
          >
            <div
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                isOutbound ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              {text}
            </div>

            <span className="text-muted-foreground text-xs">
              {dayjs(message.createdAt).format('DD.MM HH:mm')}
              {isOutbound && ` · ${MESSAGE_STATUS_LABELS[message.status]}`}
            </span>

            {/* Başarısız gönderimde sebep gösterilir: "gönderilemedi" tek başına
                kullanıcıya ne yapacağını söylemez (şablon penceresi kapandı,
                numara geçersiz, kota doldu — hepsi farklı aksiyon). */}
            {message.status === 'FAILED' && message.errorReason && (
              <span className="text-destructive text-xs">
                {message.errorReason}
              </span>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
