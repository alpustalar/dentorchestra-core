import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PatientLink } from '@/features/crm/patient/components/patient-link';
import { Badge } from '@/components/ui/badge';
import {
  type Appointment,
  appointmentStatus,
  statusLabels,
} from './appointments-workspace';

const hours = Array.from(
  { length: 12 },
  (_, index) => `${String(index + 8).padStart(2, '0')}:00`
);

export function ScheduleGrid({
  days,
  items,
  onSlotClick,
  onAppointmentClick,
}: {
  days: string[];
  items: Appointment[];
  onSlotClick: (time: string, doctor?: string) => void;
  onAppointmentClick: (item: Appointment) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-between border-b bg-muted/20 py-3">
        <CardTitle className="text-base">Takvim</CardTitle>
        <span className="text-xs text-muted-foreground">
          30 dk slot · 24 saat düzeni
        </span>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[72px_repeat(5,minmax(150px,1fr))] border-b bg-muted/10">
            <div className="border-r p-3 text-xs text-muted-foreground">
              Saat
            </div>
            {days.map((day) => (
              <div
                key={day}
                className="border-r p-3 text-sm font-medium last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="relative max-h-[600px] overflow-y-auto">
            <div className="grid grid-cols-[72px_repeat(5,minmax(150px,1fr))]">
              {hours.map((hour) => (
                <React.Fragment key={hour}>
                  <div className="h-20 border-b border-r px-3 pt-2 text-xs text-muted-foreground">
                    {hour}
                  </div>
                  {days.map((day, dayIndex) => {
                    const match = items.find(
                      (item) => item.time === hour && dayIndex === 0
                    );
                    return (
                      <button
                        type="button"
                        key={`${day}-${hour}`}
                        onClick={() =>
                          match ? onAppointmentClick(match) : onSlotClick(hour)
                        }
                        className="relative h-20 border-b border-r p-1 text-left transition-colors hover:bg-primary/5 last:border-r-0"
                      >
                        {match && (
                          <div className="flex h-full flex-col justify-between rounded-md border border-primary/20 bg-primary/10 p-2 text-xs">
                            <PatientLink
                              name={match.patient}
                              variant="compact"
                            />
                            <div className="truncate text-muted-foreground">
                              {match.type}
                            </div>
                            <Badge
                              variant={appointmentStatus(match.status)}
                              className="w-fit text-[10px]"
                            >
                              {statusLabels[match.status] ?? match.status}
                            </Badge>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
