'use client';

import * as React from 'react';
import { Paperclip, Plus, Send, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const conversations = [
  {
    name: 'Ayhan Karan',
    channel: 'WhatsApp',
    time: '3 dk',
    preview: 'Saat 3e olsun',
    unread: 2,
    tone: 'bg-chart-5/15 text-chart-5',
  },
  {
    name: 'Lucia Fernández',
    channel: 'Instagram',
    time: '18 dk',
    preview: 'Precio de rinoplastia?',
    unread: 1,
    tone: 'bg-chart-4/15 text-chart-4',
  },
  {
    name: 'Sofia Rossi',
    channel: 'E-posta',
    time: '1 sa',
    preview: 'Teklif dokümanını ilettim.',
    unread: 0,
    tone: 'bg-muted text-muted-foreground',
  },
];

export function ChatWorkspace() {
  const [channel, setChannel] = React.useState('Tümü');
  const [selected, setSelected] = React.useState('Ayhan Karan');
  const [message, setMessage] = React.useState('');
  const [sent, setSent] = React.useState<string[]>([]);

  const active =
    conversations.find((item) => item.name === selected) ?? conversations[0];
  const visible =
    channel === 'Tümü'
      ? conversations
      : conversations.filter((item) => item.channel === channel);

  const sendMessage = () => {
    if (!message.trim()) return;
    setSent((items) => [...items, message.trim()]);
    setMessage('');
  };

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6 lg:p-8">
        <header className="flex flex-col gap-3 border-b border-border/70 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-xs text-muted-foreground">
              Workspace / İletişim
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Omnichannel Inbox
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              WhatsApp, Instagram, Facebook ve e-posta görüşmelerini tek çalışma
              alanında yönetin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings2 data-icon="inline-start" />
              Gelen kutusu ayarları
            </Button>
            <Badge variant="secondary">3 açık görüşme</Badge>
          </div>
        </header>

        <section className="grid min-h-[620px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <div className="text-sm font-semibold">Görüşmeler</div>
                <div className="text-xs text-muted-foreground">
                  Tüm kanallar
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="Yeni görüşme">
                <Plus />
              </Button>
            </div>
            <div className="flex gap-1 overflow-auto border-b p-2">
              <Button
                size="sm"
                variant={channel === 'Tümü' ? 'secondary' : 'ghost'}
                onClick={() => setChannel('Tümü')}
              >
                Tümü
              </Button>
              {['WhatsApp', 'Instagram', 'E-posta'].map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={channel === item ? 'secondary' : 'ghost'}
                  onClick={() => setChannel(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            <div className="flex flex-col">
              {visible.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => setSelected(item.name)}
                  className={cn(
                    'flex items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50',
                    selected === item.name && 'bg-primary/5'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      item.tone
                    )}
                  >
                    {item.channel.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {item.time}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {item.preview}
                    </span>
                  </span>
                  {item.unread ? (
                    <Badge className="size-5 justify-center rounded-full p-0 text-[10px]">
                      {item.unread}
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <div className="text-sm font-semibold">{active.name}</div>
                <div className="text-xs text-muted-foreground">
                  {active.channel} · Yanıt bekliyor
                </div>
              </div>
              <Button variant="outline" size="sm">
                Kişi profili
              </Button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-auto bg-muted/10 p-5">
              <div className="max-w-[76%] self-start rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                  {active.name} · bugün 14:32
                </div>
                {active.preview}
              </div>
              <div className="max-w-[76%] self-end rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
                <div className="mb-1 text-[11px] opacity-70">
                  Zeynep · bugün 14:35
                </div>
                Merhaba, size yardımcı olmaktan memnuniyet duyarım.
              </div>
              {sent.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="max-w-[76%] self-end rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="border-t bg-card p-3">
              <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
                <Button variant="ghost" size="icon" aria-label="Dosya ekle">
                  <Paperclip />
                </Button>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Mesajınızı yazın..."
                  className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                  aria-label="Mesajınızı yazın"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  aria-label="Mesaj gönder"
                >
                  <Send />
                </Button>
              </div>
              <div className="mt-2 px-2 text-[11px] text-muted-foreground">
                Enter gönderir · Shift + Enter yeni satır
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
