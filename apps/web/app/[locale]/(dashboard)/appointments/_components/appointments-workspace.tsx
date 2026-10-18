'use client';

import { appointments as sourceAppointments } from '@/lib/data';

export type Appointment = {
  time: string;
  patient: string;
  type: string;
  clinic: string;
  doctor: string;
  status: string;
  endTime: string;
};

export const providers = [
  'Tümü',
  ...Array.from(new Set(sourceAppointments.map((item) => item.doctor))),
];
export const clinics = [
  'Tüm klinikler',
  ...Array.from(new Set(sourceAppointments.map((item) => item.clinic))),
];
export const statusLabels: Record<string, string> = {
  confirmed: 'Onaylandı',
  'in-progress': 'Devam ediyor',
  waiting: 'Bekliyor',
  cancelled: 'İptal',
};
export const appointmentStatus = (value: string) =>
  value === 'confirmed'
    ? ('secondary' as const)
    : value === 'cancelled'
      ? ('destructive' as const)
      : ('outline' as const);

export const appointments: Appointment[] = sourceAppointments.map(
  (item, index) => ({
    ...item,
    endTime:
      index === 2
        ? '11:15'
        : `${String(Number(item.time.slice(0, 2)) + 1).padStart(2, '0')}:${item.time.slice(3)}`,
  })
);
