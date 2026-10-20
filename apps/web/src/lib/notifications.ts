import { DateTimeManager } from '@shared/common';
import { formatLongDate } from '@/lib/date-time';

export type NotificationType =
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_CONFIRMED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_CANCELLED_LATE'
  | 'APPOINTMENT_RESCHEDULED'
  | 'WORK_ORDER_OVERDUE'
  | 'WORK_ORDER_DUE_SOON'
  | 'SYSTEM_ANNOUNCEMENT';
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationDeepLink = {
  page: 'appointments' | 'work-orders' | 'announcements';
  id?: string;
  action?: 'open_modal' | 'open_detail';
};
export type StaffNotification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  deepLink: NotificationDeepLink | null;
  priority: NotificationPriority;
  isRead: boolean;
  createdAt: string;
};

export const notificationTypeKeys: Record<NotificationType, string> = {
  APPOINTMENT_REQUESTED: 'appointmentRequested',
  APPOINTMENT_CONFIRMED: 'appointmentConfirmed',
  APPOINTMENT_CANCELLED: 'appointmentCancelled',
  APPOINTMENT_CANCELLED_LATE: 'appointmentCancelledLate',
  APPOINTMENT_RESCHEDULED: 'appointmentRescheduled',
  WORK_ORDER_OVERDUE: 'workOrderOverdue',
  WORK_ORDER_DUE_SOON: 'workOrderDueSoon',
  SYSTEM_ANNOUNCEMENT: 'systemAnnouncement',
};

const notificationDate = (options: {
  days?: number;
  hours?: number;
  minutes?: number;
}) => DateTimeManager.toIsoString(DateTimeManager.minus(options));
const maintenanceDate = formatLongDate(
  DateTimeManager.addDays(DateTimeManager.create(), 3)
);

export const seedNotifications: StaffNotification[] = [
  {
    id: 'n-1',
    type: 'APPOINTMENT_CANCELLED_LATE',
    title: 'Randevu iptali',
    body: 'Elif Yıldız randevusunu son dakika iptal etti.',
    deepLink: {
      page: 'appointments',
      id: 'appointment-uuid',
      action: 'open_modal',
    },
    priority: 'CRITICAL',
    isRead: false,
    createdAt: notificationDate({ minutes: 18 }),
  },
  {
    id: 'n-2',
    type: 'APPOINTMENT_REQUESTED',
    title: 'Yeni randevu talebi',
    body: 'James Miller yeni bir randevu talebi gönderdi.',
    deepLink: {
      page: 'appointments',
      id: 'appointment-2',
      action: 'open_modal',
    },
    priority: 'HIGH',
    isRead: false,
    createdAt: notificationDate({ hours: 1, minutes: 40 }),
  },
  {
    id: 'n-3',
    type: 'WORK_ORDER_OVERDUE',
    title: 'Geciken iş emri',
    body: 'Saç ekimi operasyon hazırlığı gecikmiş durumda.',
    deepLink: { page: 'work-orders', id: 'wo-12', action: 'open_detail' },
    priority: 'HIGH',
    isRead: false,
    createdAt: notificationDate({ hours: 3 }),
  },
  {
    id: 'n-4',
    type: 'APPOINTMENT_CONFIRMED',
    title: 'Randevu onaylandı',
    body: 'Ayşe Korkmaz randevusu onaylandı.',
    deepLink: { page: 'appointments', id: 'appointment-3' },
    priority: 'MEDIUM',
    isRead: true,
    createdAt: notificationDate({ hours: 19 }),
  },
  {
    id: 'n-5',
    type: 'WORK_ORDER_DUE_SOON',
    title: 'İş emri yaklaşıyor',
    body: 'Bugün başlayacak iki iş emri var.',
    deepLink: { page: 'work-orders' },
    priority: 'MEDIUM',
    isRead: true,
    createdAt: notificationDate({ days: 1 }),
  },
  {
    id: 'n-6',
    type: 'SYSTEM_ANNOUNCEMENT',
    title: 'Sistem duyurusu',
    body: `Bakım penceresi ${maintenanceDate} gecesi uygulanacaktır.`,
    deepLink: null,
    priority: 'LOW',
    isRead: true,
    createdAt: notificationDate({ days: 2 }),
  },
];

export function resolveNotificationDeepLink(
  link: unknown,
  clinicSlug?: string
) {
  if (!link || typeof link !== 'object')
    return { href: null, supported: false };
  const value = link as Partial<NotificationDeepLink>;
  if (
    !['appointments', 'work-orders', 'announcements'].includes(value.page ?? '')
  )
    return { href: null, supported: false };
  const clinicPrefix = clinicSlug ? `/${clinicSlug}` : '';
  const href =
    value.page === 'appointments'
      ? `${clinicPrefix}/clinical/appointment${value.id ? `?appointmentId=${encodeURIComponent(value.id)}` : ''}`
      : value.page === 'work-orders'
        ? `${clinicPrefix}/supply/work-order${value.id ? `?workOrderId=${encodeURIComponent(value.id)}` : ''}`
        : null;
  return { href, supported: href !== null };
}

export function notificationRelativeTime(date: string, locale: string) {
  const seconds = Math.max(
    0,
    DateTimeManager.diffInSeconds(
      DateTimeManager.create(),
      DateTimeManager.create(date)
    )
  );
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (seconds < 60) return formatter.format(-seconds, 'second');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');
  return formatter.format(-Math.floor(hours / 24), 'day');
}
