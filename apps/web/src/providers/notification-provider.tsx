'use client';

import * as React from 'react';
import { seedNotifications, type StaffNotification } from '@/lib/notifications';

type NotificationContextValue = {
  notifications: StaffNotification[];
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  unreadCount: number;
};
const NotificationContext =
  React.createContext<NotificationContextValue | null>(null);

export function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = React.useState(seedNotifications);
  const markRead = React.useCallback(
    (id: string) =>
      setNotifications((items) =>
        items.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      ),
    []
  );
  const markUnread = React.useCallback(
    (id: string) =>
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, isRead: false } : item
        )
      ),
    []
  );
  const markAllRead = React.useCallback(
    () =>
      setNotifications((items) =>
        items.map((item) => ({ ...item, isRead: true }))
      ),
    []
  );
  const value = React.useMemo(
    () => ({
      notifications,
      markRead,
      markUnread,
      markAllRead,
      unreadCount: notifications.filter((item) => !item.isRead).length,
    }),
    [notifications, markRead, markUnread, markAllRead]
  );
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const value = React.useContext(NotificationContext);
  if (!value) throw new Error('NotificationProvider is required');
  return value;
}
