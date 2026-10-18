'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { type Appointment } from './appointments-workspace';

interface AppointmentDetailsProps {
  item: Appointment;
}

export function AppointmentDetails({ item }: AppointmentDetailsProps) {
  const t = useTranslations('AppointmentDetails');

  // `has` kontrolü ile bilinmeyen durumlar için fallback mekanizması
  const statusLabel = t.has(`statuses.${item.status}`)
    ? t(`statuses.${item.status}`)
    : item.status;

  const details = [
    { id: 'doctor', label: t('doctor'), value: item.doctor },
    { id: 'clinic', label: t('clinic'), value: item.clinic },
    { id: 'treatment', label: t('treatment'), value: item.type },
    { id: 'status', label: t('status'), value: statusLabel },
  ];

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="text-lg font-semibold">{item.patient}</div>
        <div className="mt-1 text-muted-foreground">
          {item.time}–{item.endTime} · {t('timeZone')}
        </div>
      </div>

      {details.map(({ id, label, value }) => (
        <div
          key={id}
          className="flex items-center justify-between border-b pb-3"
        >
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value}</span>
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm">
          {t('actions.edit')}
        </Button>
        <Button size="sm">{t('actions.checkIn')}</Button>
      </div>
    </div>
  );
}
