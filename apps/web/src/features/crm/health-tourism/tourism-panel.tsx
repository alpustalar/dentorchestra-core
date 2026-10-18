import { tourismPatients } from '@/lib/data';
import { Card } from '@/components/ui/card';

const stageColor: Record<string, string> = {
  Konsültasyon: 'bg-chart-2/15 text-chart-2',
  'Teklif Gönderildi': 'bg-chart-4/15 text-chart-4',
  'Transfer Bekleniyor': 'bg-amber-500/15 text-amber-600',
  'Tedavi Sürüyor': 'bg-chart-5/15 text-chart-5',
};

export function TourismPanel() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Sağlık Turizmi
          </h2>
          <p className="text-xs text-muted-foreground">
            Uluslararası hasta akışı
          </p>
        </div>
        <button className="text-xs font-medium text-primary hover:underline">
          Tümü
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        {tourismPatients.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-3 rounded-lg border border-border p-3"
          >
            <span className="text-2xl leading-none">{p.flag}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {p.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {p.country} · {p.package}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold text-foreground">
                {p.value}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${stageColor[p.stage]}`}
              >
                {p.stage}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
