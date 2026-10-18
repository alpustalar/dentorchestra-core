import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PatientLink } from '@/features/crm/patient/components/patient-link';
import { type Appointment } from './appointments-workspace';

type Props = {
  items: Appointment[];
  onSelect: (item: Appointment) => void;
};

export function WaitingRoom({ items, onSelect }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bekleme odası</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.length ? (
          items.map((item) => (
            <button
              type="button"
              key={item.patient}
              onClick={() => onSelect(item)}
              className="rounded-lg border p-4 text-left hover:bg-muted/20"
            >
              <div className="flex items-center justify-between">
                <PatientLink name={item.patient} showStatus variant="compact" />
                <Badge variant="outline">{item.time}</Badge>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {item.doctor} · {item.clinic}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                Check-in kaydı mevcut · Bekleme süresi hesaplanıyor
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Şu anda bekleme odasında hasta bulunmuyor.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
