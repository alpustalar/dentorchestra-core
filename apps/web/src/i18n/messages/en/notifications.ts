export default {
  Notifications: {
    title: 'Notifications',
    description:
      'Stay up to date with appointments, work orders and clinic announcements.',
    unread: 'Unread',
    unreadCount: '{count} unread',
    lastUpdated: 'Updated {date}',
    types: {
      appointmentRequested: 'Appointment requested',
      appointmentConfirmed: 'Appointment confirmed',
      appointmentCancelled: 'Appointment cancelled',
      appointmentCancelledLate: 'Late appointment cancellation',
      appointmentRescheduled: 'Appointment rescheduled',
      workOrderOverdue: 'Overdue work order',
      workOrderDueSoon: 'Work order due soon',
      systemAnnouncement: 'System announcement',
    },
    priorities: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical',
    },
    filters: { all: 'All', unread: 'Unread', read: 'Read' },
    actions: {
      open: 'Open notifications',
      markAllRead: 'Mark all as read',
      markRead: 'Mark as read',
      markUnread: 'Mark as unread',
      viewAll: 'View all notifications',
    },
    empty: {
      title: 'You’re all caught up',
      description: 'There are no notifications in this view.',
    },
  },
} as const;
