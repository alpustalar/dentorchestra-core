import { leadFunnel, adChannels } from '@/lib/data';
import { Card } from '@/components/ui/card';

const maxFunnel = leadFunnel[0].value;

export function LeadsPanel() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Reklam &amp; Lead Hunisi
          </h2>
          <p className="text-xs text-muted-foreground">Bu ayki dönüşüm akışı</p>
        </div>
        <span className="rounded-full bg-chart-5/15 px-2 py-0.5 text-xs font-semibold text-chart-5">
          %9,1 dönüşüm
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {leadFunnel.map((stage) => (
          <div key={stage.stage}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{stage.stage}</span>
              <span className="font-semibold text-foreground">
                {stage.value.toLocaleString('tr-TR')}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(stage.value / maxFunnel) * 100}%`,
                  background: stage.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Kanal Bazında
        </p>
        <div className="flex flex-col gap-3">
          {adChannels.map((ch) => (
            <div key={ch.name} className="flex items-center gap-3 text-sm">
              <span className="flex-1 text-foreground">{ch.name}</span>
              <span className="w-10 text-right font-semibold text-foreground">
                {ch.value}
              </span>
              <span className="w-14 text-right text-xs text-muted-foreground">
                {ch.spend}
              </span>
              <span className="w-14 text-right text-xs text-muted-foreground">
                {ch.cpl}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-wider text-muted-foreground/60">
            <span className="flex-1">Kanal</span>
            <span className="w-10 text-right">Lead</span>
            <span className="w-14 text-right">Harcama</span>
            <span className="w-14 text-right">CPL (TL)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
