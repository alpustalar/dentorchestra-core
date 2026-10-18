'use client';

import * as React from 'react';
import { Bell, CalendarCheck, Check, CircleAlert, Wrench } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  notificationRelativeTime,
  notificationTypeKeys,
  resolveNotificationDeepLink,
  type StaffNotification,
} from '@/lib/notifications';
import { useNotifications } from '../../../../providers/notification-provider';

const icons = { appointment: CalendarCheck, work: Wrench, system: Bell };
function iconFor(type: StaffNotification['type']) {
  return type.startsWith('APPOINTMENT')
    ? icons.appointment
    : type.startsWith('WORK_ORDER')
      ? icons.work
      : icons.system;
}
function priorityVariant(priority: StaffNotification['priority']) {
  return priority === 'CRITICAL'
    ? 'destructive'
    : priority === 'HIGH'
      ? 'outline'
      : 'secondary';
}

export function NotificationItem({
  item,
  compact = false,
}: {
  item: StaffNotification;
  compact?: boolean;
}) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const router = useRouter();
  const { markRead, markUnread } = useNotifications();
  const Icon = iconFor(item.type);
  const navigate = () => {
    markRead(item.id);
    const result = resolveNotificationDeepLink(item.deepLink);
    if (result.supported && result.href) router.push(result.href as never);
  };
  return (
    <article
      className={cn(
        'group flex gap-3 border-b border-border/70 p-4 transition-colors',
        !item.isRead && 'bg-primary/[0.045]',
        compact && 'p-3'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          item.priority === 'CRITICAL'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon data-icon="inline-start" />
      </div>
      <button
        type="button"
        onClick={navigate}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="font-medium leading-5">{item.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {notificationRelativeTime(item.createdAt, locale)}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {item.body}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={priorityVariant(item.priority)}>
            {t(`priorities.${item.priority.toLowerCase()}`)}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t(`types.${notificationTypeKeys[item.type]}`)}
          </span>
          {!item.isRead && (
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-label={t('unread')}
            />
          )}
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        onClick={() => (item.isRead ? markUnread(item.id) : markRead(item.id))}
        aria-label={
          item.isRead ? t('actions.markUnread') : t('actions.markRead')
        }
      >
        <Check />
      </Button>
    </article>
  );
}

export function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const t = useTranslations('Notifications');
  const router = useRouter();
  const { notifications, markAllRead, unreadCount } = useNotifications();
  return (
    <div className="absolute right-0 top-12 z-40 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <h2 className="font-semibold">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('unreadCount', { count: unreadCount })}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
          {t('actions.markAllRead')}
        </Button>
      </div>
      <div className="max-h-[min(520px,70vh)] overflow-auto">
        {notifications.slice(0, 8).map((item) => (
          <NotificationItem key={item.id} item={item} compact />
        ))}
      </div>
      <button
        type="button"
        className="w-full border-t p-3 text-center text-sm font-medium text-primary hover:bg-muted"
        onClick={() => {
          onClose();
          router.push('/notifications');
        }}
      >
        {t('actions.viewAll')}
      </button>
    </div>
  );
}

export function NotificationCenter() {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  const filtered = notifications.filter(
    (item) =>
      filter === 'all' || (filter === 'unread' ? !item.isRead : item.isRead)
  );
  return (
    <div className="mx-auto w-full max-w-5xl p-4 md:p-8">
      <header className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Workspace / {t('title')}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button variant="outline" onClick={markAllRead}>
          {t('actions.markAllRead')}
        </Button>
      </header>
      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['all', 'unread', 'read'] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? 'secondary' : 'ghost'}
              onClick={() => setFilter(value)}
            >
              {t(`filters.${value}`)}
            </Button>
          ))}
        </div>
        <Badge variant="secondary">
          {t('unreadCount', { count: unreadCount })}
        </Badge>
      </div>
      <section className="mt-4 overflow-hidden rounded-xl border bg-card">
        {filtered.length ? (
          filtered.map((item) => <NotificationItem key={item.id} item={item} />)
        ) : (
          <div className="flex flex-col items-center gap-2 p-16 text-center">
            <CircleAlert className="text-muted-foreground" />
            <h2 className="font-medium">{t('empty.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('empty.description')}
            </p>
          </div>
        )}
      </section>
      <p className="mt-4 text-xs text-muted-foreground">
        {t('lastUpdated', {
          date: new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date()),
        })}
      </p>
    </div>
  );
}
