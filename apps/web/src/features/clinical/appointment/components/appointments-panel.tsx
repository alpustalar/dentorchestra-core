import { appointments } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const statusMap: Record<string, { label: string; className: string }> = {
  confirmed: { label: 'Onaylı', className: 'bg-primary/12 text-primary' },
  'in-progress': {
    label: 'Devam ediyor',
    className: 'bg-chart-3/15 text-chart-3',
  },
  waiting: { label: 'Bekliyor', className: 'bg-amber-500/15 text-amber-600' },
  cancelled: {
    label: 'İptal',
    className: 'bg-destructive/12 text-destructive',
  },
};

const clinicDot: Record<string, string> = {
  'Diş Kliniği': 'var(--chart-1)',
  'Saç Ekimi': 'var(--chart-2)',
  'Estetik Cerrahi': 'var(--chart-3)',
};

export function AppointmentsPanel() {
  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Bugünün Randevuları
          </h2>
          <p className="text-xs text-muted-foreground">6 randevu · 3 doktor</p>
        </div>
        <button className="text-xs font-medium text-primary hover:underline">
          Takvimi aç
        </button>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border">
        {appointments.map((a) => {
          const s = statusMap[a.status];
          return (
            <div
              key={a.time + a.patient}
              className="flex items-center gap-4 py-3"
            >
              <div className="w-12 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {a.time}
              </div>
              <span
                className="h-8 w-1 shrink-0 rounded-full"
                style={{ background: clinicDot[a.clinic] }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {a.patient}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.type} · {a.doctor}
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  s.className
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
