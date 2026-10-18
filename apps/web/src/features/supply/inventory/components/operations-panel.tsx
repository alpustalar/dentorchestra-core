import { AlertTriangle } from 'lucide-react';
import { lowStock, staffOnDuty } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const staffStatus: Record<string, { label: string; dot: string }> = {
  available: { label: 'Müsait', dot: 'bg-chart-5' },
  busy: { label: 'Meşgul', dot: 'bg-destructive' },
  break: { label: 'Molada', dot: 'bg-amber-500' },
};

export function OperationsPanel() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h2 className="text-sm font-semibold text-foreground">Kritik Stok</h2>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {lowStock.map((s) => (
          <div key={s.item}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate pr-2 text-foreground">{s.item}</span>
              <span className="shrink-0 font-semibold text-destructive">
                {s.stock}/{s.min} {s.unit}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-destructive"
                style={{ width: `${Math.min((s.stock / s.min) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Görevdeki Ekip
        </h3>
        <div className="flex flex-col gap-2.5">
          {staffOnDuty.map((m) => {
            const st = staffStatus[m.status];
            return (
              <div key={m.name} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                  {m.initials}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.role}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', st.dot)} />
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
