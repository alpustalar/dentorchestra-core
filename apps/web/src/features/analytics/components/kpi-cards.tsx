import {
  CalendarCheck,
  Megaphone,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { kpis } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const iconMap = {
  revenue: Wallet,
  patients: Users,
  appointments: CalendarCheck,
  leads: Megaphone,
} as const;

export function KpiCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.id as keyof typeof iconMap];
        const positive = kpi.delta >= 0;
        return (
          <Card key={kpi.id} className="gap-0 p-5">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                  positive
                    ? 'bg-chart-5/15 text-chart-5'
                    : 'bg-destructive/15 text-destructive'
                )}
              >
                {positive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {positive ? '+' : ''}
                {kpi.delta}%
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {kpi.value}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{kpi.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">{kpi.sub}</p>
          </Card>
        );
      })}
    </div>
  );
}
