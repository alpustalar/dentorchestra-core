'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { appointments } from '@/features/clinical/appointment/data/mock-appointments';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { DateTimeManager } from '@shared/common';
import { useTranslations } from 'next-intl';

// UI renk sınıfları (Zod şemasına tam uyumlu)
const statusStyles: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-600',
  CONFIRMED: 'bg-primary/12 text-primary',
  ARRIVED: 'bg-blue-500/15 text-blue-600',
  IN_PROGRESS: 'bg-chart-3/15 text-chart-3',
  COMPLETED: 'bg-emerald-500/15 text-emerald-600',
  CANCELLED: 'bg-destructive/12 text-destructive',
  NOSHOW: 'bg-destructive/12 text-destructive',
};

// Klinik ID'lerine göre şık renkler (veya tailwind değişkenleri)
const clinicDotColors: Record<string, string> = {
  clinic_fethiye: 'var(--chart-1)',
  clinic_ataevler: 'var(--chart-2)',
  clinic_besevler: 'var(--chart-3)',
};

export function AppointmentsPanel() {
  const t = useTranslations('AppointmentDetails.statuses');

  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Bugünün Randevuları
          </h2>
          <p className="text-xs text-muted-foreground">
            {appointments.length} randevu · Aktif liste
          </p>
        </div>
        <button className="text-xs font-medium text-primary hover:underline cursor-pointer">
          Takvimi aç
        </button>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {appointments.map((a) => {
          const upperStatus = String(a.status).toUpperCase();
          const statusClass =
            statusStyles[upperStatus] ?? 'bg-muted text-muted-foreground';

          // Klinik adını ID üzerinden buluyoruz (DDD ve normalize yapı gereği)
          const clinicObj = clinics.find((c) => c.id === a.clinicId);
          const clinicName = clinicObj ? clinicObj.name : a.clinicId;
          const dotColor = clinicDotColors[a.clinicId] ?? 'var(--primary)';

          // DateTimeManager ile saati formatlıyoruz (Örn: 14:30)
          const formattedTime = DateTimeManager.formatDateTime(
            DateTimeManager.create(a.startTime)
          ).slice(11, 16);

          return (
            <div key={a.id} className="flex items-center gap-4 py-3">
              <div className="w-12 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {formattedTime}
              </div>
              <span
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ background: dotColor }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {a.patientId} {/* İleride Hasta adını resolve edeceğiz */}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {clinicName} · {a.providerId}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  statusClass
                )}
              >
                {t(upperStatus) || upperStatus}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
