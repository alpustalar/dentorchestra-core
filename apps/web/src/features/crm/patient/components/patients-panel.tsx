import { recentPatients } from '@/lib/data';
import { Card } from '@/components/ui/card';

const clinicColor: Record<string, string> = {
  Diş: 'var(--chart-1)',
  Saç: 'var(--chart-2)',
  Estetik: 'var(--chart-3)',
};

export function PatientsPanel() {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Aktif Tedavi Süreçleri
          </h2>
          <p className="text-xs text-muted-foreground">
            Devam eden hasta planları
          </p>
        </div>
        <button className="text-xs font-medium text-primary hover:underline">
          Tümü
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {recentPatients.map((p) => (
          <div key={p.name} className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
              style={{ background: clinicColor[p.clinic] }}
            >
              {p.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.name}
                </p>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                  %{p.progress}
                </span>
              </div>
              <p className="mb-1.5 truncate text-xs text-muted-foreground">
                {p.treatment}
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${p.progress}%`,
                    background: clinicColor[p.clinic],
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
