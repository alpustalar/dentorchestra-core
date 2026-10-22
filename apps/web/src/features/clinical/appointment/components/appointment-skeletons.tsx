import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export type AppointmentDataView = 'calendar' | 'list' | 'waiting';
export type AppointmentCalendarRange = 'day' | 'week';

export function AppointmentDataSkeleton({
  view,
  range,
}: {
  readonly view: AppointmentDataView;
  readonly range: AppointmentCalendarRange;
}) {
  if (view === 'list') return <AppointmentListSkeleton />;
  if (view === 'waiting') return <AppointmentWaitingRoomSkeleton />;

  return <AppointmentCalendarSkeleton dayCount={range === 'week' ? 5 : 1} />;
}

export function AppointmentsPageSkeleton() {
  return (
    <main className="min-h-full bg-background" aria-hidden="true">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6 lg:p-8">
        <header className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-44" />
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-28" />
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="size-8" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="size-8" />
            <Skeleton className="ml-1 h-4 w-40" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        <div className="flex items-center gap-2 border-b pb-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>

        <AppointmentCalendarSkeleton dayCount={1} />
      </div>
    </main>
  );
}

export function AppointmentSettingsSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      {[4, 1, 2].map((rowCount, sectionIndex) => (
        <section key={sectionIndex}>
          <Skeleton className="h-4 w-44" />
          <div className="mt-2 divide-y rounded-lg border px-3">
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="flex min-h-16 items-center justify-between gap-4 py-3"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AppointmentCalendarSkeleton({ dayCount }: { dayCount: number }) {
  const gridTemplateColumns = `72px repeat(${dayCount}, minmax(150px, 1fr))`;

  return (
    <Card className="overflow-hidden" aria-hidden="true">
      <CardHeader className="flex-row items-center justify-between border-b bg-muted/20 py-3">
        <Skeleton className="h-5 w-24" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden p-0">
        <div className="min-w-[760px]">
          <div
            className="grid border-b bg-muted/10"
            style={{ gridTemplateColumns }}
          >
            <div className="border-r p-3">
              <Skeleton className="h-3 w-8" />
            </div>
            {Array.from({ length: dayCount }, (_, index) => (
              <div key={index} className="border-r p-3 last:border-r-0">
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns }}>
            <div className="space-y-12 border-r px-3 py-4">
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-3 w-9" />
              ))}
            </div>
            {Array.from({ length: dayCount }, (_, dayIndex) => (
              <div
                key={dayIndex}
                className="relative h-[560px] border-r bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_59px,var(--border)_60px)] last:border-r-0"
              >
                <Skeleton
                  className="absolute left-3 right-3 h-20 rounded-lg"
                  style={{ top: 36 + (dayIndex % 3) * 54 }}
                />
                <Skeleton
                  className="absolute left-3 right-3 h-28 rounded-lg"
                  style={{ top: 230 + (dayIndex % 2) * 74 }}
                />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentListSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardContent className="overflow-hidden p-0">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-6 gap-5 border-b bg-muted/20 px-5 py-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-3 w-16" />
            ))}
          </div>
          <div className="divide-y">
            {Array.from({ length: 7 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-6 items-center gap-5 px-5 py-4"
              >
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentWaitingRoomSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-4 h-3 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
