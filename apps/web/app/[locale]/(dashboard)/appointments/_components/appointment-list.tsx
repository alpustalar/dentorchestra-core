import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PatientLink } from '@/features/crm/patient/components/patient-link';
import {
  type Appointment,
  appointmentStatus,
  statusLabels,
} from './appointments-workspace';

export function AppointmentList({
  items,
  onSelect,
}: {
  items: Appointment[];
  onSelect: (item: Appointment) => void;
}) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/20 text-left text-xs text-muted-foreground">
            <tr>
              {['Hasta', 'Tarih', 'Saat', 'Uzman', 'Klinik', 'Durum'].map(
                (label) => (
                  <th key={label} className="px-5 py-3 font-medium">
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.patient}
                onClick={() => onSelect(item)}
                className="cursor-pointer border-t hover:bg-muted/20"
              >
                <td className="px-5 py-4">
                  <PatientLink
                    name={item.patient}
                    showProtocol
                    variant="compact"
                  />
                </td>
                <td className="px-5 py-4">13 Ağu 2026</td>
                <td className="px-5 py-4">
                  {item.time}–{item.endTime}
                </td>
                <td className="px-5 py-4">{item.doctor}</td>
                <td className="px-5 py-4">{item.clinic}</td>
                <td className="px-5 py-4">
                  <Badge variant={appointmentStatus(item.status)}>
                    {statusLabels[item.status] ?? item.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
