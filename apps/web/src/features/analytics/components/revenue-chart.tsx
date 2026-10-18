'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { revenueByMonth } from '@/lib/data';
import { Card } from '@/components/ui/card';

const series = [
  { key: 'fethiye', label: 'Fethiye', color: 'var(--chart-1)' },
  { key: 'ataevler', label: 'Ataevler', color: 'var(--chart-2)' },
  { key: 'besevler', label: 'Beşevler', color: 'var(--chart-3)' },
] as const;

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-popover-foreground">{label} 2026</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">
            {series.find((s) => s.key === p.dataKey)?.label}
          </span>
          <span className="ml-auto font-semibold text-popover-foreground">
            {p.value}K TL
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart() {
  return (
    <Card className="p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Gelir Trendi
          </h2>
          <p className="text-xs text-muted-foreground">
            Kliniklere göre aylık ciro (bin TL)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {series.map((s) => (
            <div
              key={s.key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={revenueByMonth}
            margin={{ left: -12, right: 8, top: 8 }}
          >
            <defs>
              {series.map((s) => (
                <linearGradient
                  key={s.key}
                  id={`grad-${s.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {series.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                stackId="1"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
