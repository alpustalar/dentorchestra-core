'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { NotificationDropdown } from '@/features/platform/notification/components/notification-center';
import { useNotifications } from '@/providers/notification-provider';

export function NotificationBell() {
  const t = useTranslations();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { unreadCount } = useNotifications();

  useEffect(() => {
    if (!notificationsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }

      setNotificationsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [notificationsOpen]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-label={t('Notifications.actions.open')}
        aria-expanded={notificationsOpen}
        onClick={() => setNotificationsOpen((value) => !value)}
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted"
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
