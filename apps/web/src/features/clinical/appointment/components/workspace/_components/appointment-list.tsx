'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PatientLink } from '@/features/crm/patient/components/patient-link';
import type { CalendarAppointment } from '@/features/clinical/appointment/calendar-appointment.types';
import { appointmentStatusVariants } from '@/features/clinical/appointment/data/mock-appointments';
import { DateTimeManager } from '@shared/common';

interface AppointmentListProps {
  readonly items: CalendarAppointment[];
  readonly onSelect: (item: CalendarAppointment) => void;
}

export function AppointmentList({ items, onSelect }: AppointmentListProps) {
  const t = useTranslations('AppointmentDetails');
  const format = useFormatter();

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/20 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-5 py-3 font-medium">{t('table.patient')}</th>
              <th className="px-5 py-3 font-medium">{t('table.date')}</th>
              <th className="px-5 py-3 font-medium">{t('table.time')}</th>
              <th className="px-5 py-3 font-medium">{t('table.provider')}</th>
              <th className="px-5 py-3 font-medium">{t('clinic')}</th>
              <th className="px-5 py-3 font-medium">{t('status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y border-t">
            {items.map((item) => {
              const statusKey = item.status.toUpperCase();
              const badgeVariant =
                appointmentStatusVariants[statusKey] ?? 'outline';

              return (
                <tr
                  key={item.id} // patientId yerine benzersiz appointment id kullanımı
                  onClick={() => onSelect(item)}
                  className="cursor-pointer transition-colors hover:bg-muted/20"
                >
                  <td className="px-5 py-4">
                    <PatientLink
                      name={item.patientName ?? item.patientId}
                      showProtocol
                      variant="compact"
                    />
                  </td>
                  <td className="px-5 py-4">
                    {format.dateTime(DateTimeManager.create(item.startTime), {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-5 py-4">
                    {format.dateTime(DateTimeManager.create(item.startTime), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    –{' '}
                    {format.dateTime(DateTimeManager.create(item.endTime), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-4">{item.providerId}</td>
                  <td className="px-5 py-4">{item.clinicId}</td>
                  <td className="px-5 py-4">
                    <Badge variant={badgeVariant}>
                      {t.has(`statuses.${statusKey}`)
                        ? t(`statuses.${statusKey}`)
                        : statusKey}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
