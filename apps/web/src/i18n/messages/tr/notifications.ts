export default {
  Notifications: {
    title: 'Bildirimler',
    description:
      'Randevular, iş emirleri ve klinik duyurularından haberdar olun.',
    unread: 'Okunmadı',
    unreadCount: '{count} okunmamış',
    lastUpdated: 'Güncellendi: {date}',
    types: {
      appointmentRequested: 'Randevu talebi',
      appointmentConfirmed: 'Randevu onaylandı',
      appointmentCancelled: 'Randevu iptali',
      appointmentCancelledLate: 'Geç randevu iptali',
      appointmentRescheduled: 'Randevu yeniden planlandı',
      workOrderOverdue: 'Geciken iş emri',
      workOrderDueSoon: 'Yaklaşan iş emri',
      systemAnnouncement: 'Sistem duyurusu',
    },
    priorities: {
      low: 'Düşük',
      medium: 'Orta',
      high: 'Yüksek',
      critical: 'Kritik',
    },
    filters: { all: 'Tümü', unread: 'Okunmamış', read: 'Okunmuş' },
    actions: {
      open: 'Bildirimleri aç',
      markAllRead: 'Tümünü okundu işaretle',
      markRead: 'Okundu işaretle',
      markUnread: 'Okunmadı işaretle',
      viewAll: 'Tüm bildirimleri gör',
    },
    empty: {
      title: 'Hepsi güncel',
      description: 'Bu görünümde bildirim bulunmuyor.',
    },
  },
} as const;
