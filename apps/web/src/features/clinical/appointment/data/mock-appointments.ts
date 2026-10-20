'use client';

import { mockAppointments } from '@/lib/data';
import { DateTimeManager } from '@shared/common';

export const appointmentStatusVariants: Record<
  string,
  'secondary' | 'destructive' | 'outline'
> = {
  PENDING: 'outline',
  CONFIRMED: 'secondary',
  ARRIVED: 'secondary',
  IN_PROGRESS: 'secondary',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  NOSHOW: 'destructive',
};

export const appointmentStatus = (status: string) => {
  const upper = String(status).toUpperCase();
  return appointmentStatusVariants[upper] ?? 'outline';
};

export const appointments = mockAppointments.map((item, index) => {
  const start = DateTimeManager.create(item.startTime);
  let end: Date;

  if (index === 2) {
    const dateKey = DateTimeManager.toDateString(start);
    end = DateTimeManager.fromLocalDateTime(dateKey, '11:15');
  } else {
    end = DateTimeManager.addMinutes(start, 60);
  }

  return {
    ...item,
    startTime: start,
    endTime: end,
  };
});
