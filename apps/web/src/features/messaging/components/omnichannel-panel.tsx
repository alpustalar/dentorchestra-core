import { MessageCircle, Camera, Users, Mail } from 'lucide-react';
import { inbox } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const channelMap: Record<string, { icon: any; className: string }> = {
  whatsapp: { icon: MessageCircle, className: 'bg-chart-5/15 text-chart-5' },
  instagram: { icon: Camera, className: 'bg-chart-4/15 text-chart-4' },
  facebook: { icon: Users, className: 'bg-primary/12 text-primary' },
  email: { icon: Mail, className: 'bg-muted text-muted-foreground' },
};

export function OmnichannelPanel() {
  const totalUnread = inbox.reduce((n, m) => n + m.unread, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Omnichannel Gelen Kutusu
          </h2>
          <p className="text-xs text-muted-foreground">
            WhatsApp · Instagram · Facebook · E-posta
          </p>
        </div>
        <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {totalUnread} yeni
        </span>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {inbox.map((m) => {
          const ch = channelMap[m.channel];
          const Icon = ch.icon;
          return (
            <button
              key={m.name + m.time}
              className="flex items-center gap-3 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div
                className={cn(
                  'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  ch.className
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="absolute -bottom-1 -right-1 text-sm leading-none">
                  {m.country}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.name}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.time}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {m.message}
                </p>
              </div>
              {m.unread > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[0.65rem] font-semibold text-primary-foreground">
                  {m.unread}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
