'use client';

import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NotificationDropdown } from '@/features/platform/notification/components/notification-center';
import { useNotifications } from '@/providers/notification-provider';

export function NotificationBell() {
  const t = useTranslations();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { unreadCount } = useNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('Notifications.actions.open')}
        aria-expanded={notificationsOpen}
        onClick={() => setNotificationsOpen((value) => !value)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted cursor-pointer transition-colors"
      >
        <Bell className="h-[1.15rem] w-[1.15rem]" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive ring-2 ring-card" />
        )}
      </button>
      {notificationsOpen && (
        <NotificationDropdown onClose={() => setNotificationsOpen(false)} />
      )}
    </div>
  );
}
