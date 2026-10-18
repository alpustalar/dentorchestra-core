export type NotificationType =
  | "APPOINTMENT_REQUESTED"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_CANCELLED_LATE"
  | "APPOINTMENT_RESCHEDULED"
  | "WORK_ORDER_OVERDUE"
  | "WORK_ORDER_DUE_SOON"
  | "SYSTEM_ANNOUNCEMENT";
export type NotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type NotificationDeepLink = {
  page: "appointments" | "work-orders" | "announcements";
  id?: string;
  action?: "open_modal" | "open_detail";
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
  APPOINTMENT_REQUESTED: "appointmentRequested",
  APPOINTMENT_CONFIRMED: "appointmentConfirmed",
  APPOINTMENT_CANCELLED: "appointmentCancelled",
  APPOINTMENT_CANCELLED_LATE: "appointmentCancelledLate",
  APPOINTMENT_RESCHEDULED: "appointmentRescheduled",
  WORK_ORDER_OVERDUE: "workOrderOverdue",
  WORK_ORDER_DUE_SOON: "workOrderDueSoon",
  SYSTEM_ANNOUNCEMENT: "systemAnnouncement",
};

export const seedNotifications: StaffNotification[] = [
  {
    id: "n-1",
    type: "APPOINTMENT_CANCELLED_LATE",
    title: "Randevu iptali",
    body: "Elif Yıldız randevusunu son dakika iptal etti.",
    deepLink: {
      page: "appointments",
      id: "appointment-uuid",
      action: "open_modal",
    },
    priority: "CRITICAL",
    isRead: false,
    createdAt: "2026-08-09T11:42:00+03:00",
  },
  {
    id: "n-2",
    type: "APPOINTMENT_REQUESTED",
    title: "Yeni randevu talebi",
    body: "James Miller yeni bir randevu talebi gönderdi.",
    deepLink: {
      page: "appointments",
      id: "appointment-2",
      action: "open_modal",
    },
    priority: "HIGH",
    isRead: false,
    createdAt: "2026-08-09T10:20:00+03:00",
  },
  {
    id: "n-3",
    type: "WORK_ORDER_OVERDUE",
    title: "Geciken iş emri",
    body: "Saç ekimi operasyon hazırlığı gecikmiş durumda.",
    deepLink: { page: "work-orders", id: "wo-12", action: "open_detail" },
    priority: "HIGH",
    isRead: false,
    createdAt: "2026-08-09T09:05:00+03:00",
  },
  {
    id: "n-4",
    type: "APPOINTMENT_CONFIRMED",
    title: "Randevu onaylandı",
    body: "Ayşe Korkmaz randevusu onaylandı.",
    deepLink: { page: "appointments", id: "appointment-3" },
    priority: "MEDIUM",
    isRead: true,
    createdAt: "2026-08-08T16:32:00+03:00",
  },
  {
    id: "n-5",
    type: "WORK_ORDER_DUE_SOON",
    title: "İş emri yaklaşıyor",
    body: "Bugün başlayacak iki iş emri var.",
    deepLink: { page: "work-orders" },
    priority: "MEDIUM",
    isRead: true,
    createdAt: "2026-08-08T13:10:00+03:00",
  },
  {
    id: "n-6",
    type: "SYSTEM_ANNOUNCEMENT",
    title: "Sistem duyurusu",
    body: "Bakım penceresi 12 Ağustos gecesi uygulanacaktır.",
    deepLink: null,
    priority: "LOW",
    isRead: true,
    createdAt: "2026-08-07T09:00:00+03:00",
  },
];

export function resolveNotificationDeepLink(link: unknown) {
  if (!link || typeof link !== "object")
    return { href: null, supported: false };
  const value = link as Partial<NotificationDeepLink>;
  if (
    !["appointments", "work-orders", "announcements"].includes(value.page ?? "")
  )
    return { href: null, supported: false };
  const href =
    value.page === "appointments"
      ? `/appointments${value.id ? `?appointmentId=${encodeURIComponent(value.id)}` : ""}`
      : value.page === "work-orders"
        ? `/work-orders${value.id ? `?workOrderId=${encodeURIComponent(value.id)}` : ""}`
        : `/announcements${value.id ? `?announcementId=${encodeURIComponent(value.id)}` : ""}`;
  return { href, supported: true };
}

export function notificationRelativeTime(date: string, locale: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 1000),
  );
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (seconds < 60) return formatter.format(-seconds, "second");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.floor(hours / 24), "day");
}
