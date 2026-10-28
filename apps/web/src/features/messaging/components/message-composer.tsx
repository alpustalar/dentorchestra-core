'use client';

import { useState } from 'react';
import type { ConversationResponse } from '@dentorchestra/shared/client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';

import { useSendMessage } from '../api/use-messaging-mutations';
import { asServiceWindowClosed } from '../messaging.error-codes';

interface MessageComposerProps {
  clinicId: string;
  conversation: ConversationResponse;
}

export function MessageComposer({
  clinicId,
  conversation,
}: MessageComposerProps) {
  const [body, setBody] = useState('');
  const sendMessage = useSendMessage({
    clinicId,
    conversationId: conversation.id,
  });

  const windowClosed = asServiceWindowClosed(sendMessage.error);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text) return;

    sendMessage.mutate(
      { type: 'TEXT', body: text },
      { onSuccess: () => setBody('') }
    );
  };

  // Kapalı yazışmaya yazılmaz; kullanıcı yazıp gönder deyip 400 almasın.
  if (conversation.status === 'CLOSED') {
    return (
      <p className="text-muted-foreground border-t p-3 text-sm">
        Bu yazışma kapatılmış.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 border-t p-3">
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Mesaj yaz…"
          // Pencere kapandıysa kutu kilitlenir: serbest metin gönderilemez,
          // tek yol onaylı şablon (Meta kuralı).
          disabled={Boolean(windowClosed) || sendMessage.isPending}
          aria-label="Mesaj"
        />
        <Button
          type="submit"
          disabled={
            !body.trim() || Boolean(windowClosed) || sendMessage.isPending
          }
        >
          Gönder
        </Button>
      </div>

      {windowClosed && (
        <p role="alert" className="text-destructive text-xs">
          24 saatlik servis penceresi kapalı — serbest mesaj gönderilemez.
          Yalnızca onaylı şablon gönderilebilir.
          {/* Şablon gönderimi ayrı bir uç (`/template-messages`) ve şablon
              seçimi ayrı bir ekran gerektiriyor; bu dilimde kapsam dışı. */}
        </p>
      )}

      {sendMessage.error && !windowClosed && (
        <p role="alert" className="text-destructive text-xs">
          {sendMessage.error instanceof ApiError
            ? sendMessage.error.message
            : 'Mesaj gönderilemedi.'}
        </p>
      )}
    </form>
  );
}
