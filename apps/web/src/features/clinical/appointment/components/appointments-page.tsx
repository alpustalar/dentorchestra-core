'use client';

import { SelectInput } from '@/components/ui/select-input';

import * as React from 'react';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ManagedSheet from '@/components/ui/managed-sheet';
import { WaitingRoom } from '@/features/clinical/appointment/components/workspace/_components/waiting-room';
import { ScheduleGrid } from '@/features/clinical/appointment/components/workspace/_components/schedule-grid';
import {
  CALENDAR_TIMELINE,
  type CalendarDay,
  type CalendarSelection,
} from '@/features/clinical/appointment/components/workspace/_components/calendar-selection';
import { AppointmentList } from '@/features/clinical/appointment/components/workspace/_components/appointment-list';
import { AppointmentDetails } from '@/features/clinical/appointment/components/workspace/_components/appointment-details';
import { AppointmentStatusSchema } from '@shared/generated-zod';
import {
  type CalendarAppointment,
  canResizeCalendarAppointment,
} from '../calendar-appointment.types';
import {
  useCalendarAppointmentResize,
  useCalendarAppointments,
} from '../api/use-calendar-appointments';
import { useAuth } from '@/data/auth/auth-context';
import { ApiError } from '@/lib/api';
import { providers } from '@/features/clinical/providers/data';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { DateTimeManager } from '@shared/common';
import { AppointmentSettingsSheet } from '@/features/clinical/appointment/components/appointment-settings-sheet';
import { useClinicAppointmentSettings } from '../api/use-clinic-appointment-settings';
import { DataLoadingBoundary, OfflineDataState } from '@/components/loading';
import {
  AppointmentDataSkeleton,
  type AppointmentCalendarRange,
  type AppointmentDataView,
} from './appointment-skeletons';

const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];

type Draft = {
  date: string;
  time: string;
  doctor: string;
  durationMinutes: number;
} | null;

const AppointmentsPage = () => {
  const calendarText = useTranslations('AppointmentCalendar');
  const router = useRouter();
  const { claims } = useAuth();
  const params = useParams<{
    locale: string;
    'organization-slug': string;
    'clinic-slug': string;
  }>();
  const [view, setView] = useState<AppointmentDataView>('calendar');
  const [range, setRange] = useState<AppointmentCalendarRange>('day');
  const [provider, setProvider] = useState('');
  const [clinic, setClinic] = useState('');
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [calendarSlotDurationMinutes, setCalendarSlotDurationMinutes] =
    useState(30);
  const saveLock = React.useRef(false);
  const resizeAppointment = useCalendarAppointmentResize();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CalendarAppointment | null>(null);
  const [draft, setDraft] = useState<Draft>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<readonly string[] | null>(
    null
  );

  const [anchorDate, setAnchorDate] = useState<Date>(() =>
    DateTimeManager.create()
  );

  // Haftanın Pazartesi gününü bul
  const dayOfWeek = DateTimeManager.getDayOfWeek(anchorDate);
  const daysToMonday = (dayOfWeek + 6) % 7;
  const weekStart = DateTimeManager.subtractDays(anchorDate, daysToMonday);

  const dateLabel =
    range === 'day'
      ? DateTimeManager.formatDateTime(anchorDate).split(' ')[0] // DD.MM.YYYY
      : `${DateTimeManager.toDateKey(weekStart)} – ${DateTimeManager.toDateKey(
          DateTimeManager.addDays(weekStart, 4)
        )}`;

  const gridDays: CalendarDay[] =
    range === 'day'
      ? [
          {
            date: DateTimeManager.toDateKey(anchorDate),
            label: `${DateTimeManager.isSameDay(anchorDate, DateTimeManager.create()) ? 'Bugün' : 'Seçili gün'} · ${DateTimeManager.toDateKey(anchorDate)}`,
          },
        ]
      : dayNames.map((day, index) => {
          const targetDate = DateTimeManager.addDays(weekStart, index);
          return {
            date: DateTimeManager.toDateKey(targetDate),
            label: `${day} · ${DateTimeManager.toDateKey(targetDate)}`,
          };
        });

  const clinicId = clinic || claims.clinicId;
  const appointmentSettings = useClinicAppointmentSettings(clinicId);
  const calendarQuery = useCalendarAppointments({
    clinicId,
    startDate: DateTimeManager.fromLocalDateTime(
      gridDays[0].date,
      '00:00'
    ).toISOString(),
    endDate: DateTimeManager.subtractMilliseconds(
      DateTimeManager.addDays(
        DateTimeManager.fromLocalDateTime(
          gridDays[gridDays.length - 1].date,
          '00:00'
        ),
        1
      ),
      1
    ).toISOString(),
  });
  const visible = (calendarQuery.data?.items ?? []).filter(
    (item) =>
      (!provider || item.providerId === provider) &&
      (item.patientName || item.patientId || '')
        .toLocaleLowerCase('tr')
        .includes(query.toLocaleLowerCase('tr'))
  );
  const canResizeAppointments =
    claims.capabilities.includes('appointment.update') &&
    Boolean(
      calendarQuery.data?.groups.some((group) =>
        ['INTERNAL', 'MANAGEMENT', 'ADMIN', 'PROVIDER_DATA_OWNER'].includes(
          group
        )
      )
    );

  const handleAppointmentResize = async (
    item: CalendarAppointment,
    selection: CalendarSelection
  ) => {
    if (
      saveLock.current ||
      !resizeEnabled ||
      !canResizeAppointments ||
      !canResizeCalendarAppointment(item)
    )
      return;
    saveLock.current = true;
    try {
      await resizeAppointment.mutateAsync({
        appointment: item,
        startTime: DateTimeManager.fromLocalDateTime(
          selection.date,
          DateTimeManager.minutesToHHMM(selection.startMinute)
        ),
        endTime: DateTimeManager.fromLocalDateTime(
          selection.date,
          DateTimeManager.minutesToHHMM(selection.endMinute)
        ),
      });
    } finally {
      saveLock.current = false;
    }
  };

  const feedback: { kind: 'error' | 'status'; message: string } | undefined =
    resizeAppointment.isPending
      ? { kind: 'status', message: calendarText('saving') }
      : resizeAppointment.isError
        ? {
            kind: 'error',
            message: calendarText(
              resizeAppointment.error instanceof ApiError &&
                resizeAppointment.error.isConflict
                ? 'resizeConflict'
                : 'resizeError'
            ),
          }
        : calendarQuery.isError
          ? { kind: 'error', message: calendarText('loadError') }
          : calendarQuery.isLoading
            ? { kind: 'status', message: calendarText('loading') }
            : resizeAppointment.isSuccess
              ? { kind: 'status', message: calendarText('resizeSuccess') }
              : undefined;

  // Tarih İlerleme / Gerileme
  const moveDate = (amount: number) => {
    setAnchorDate((current) =>
      range === 'day'
        ? amount > 0
          ? DateTimeManager.addDays(current, amount)
          : DateTimeManager.subtractDays(current, Math.abs(amount))
        : amount > 0
          ? DateTimeManager.addDays(current, amount * 7)
          : DateTimeManager.subtractDays(current, Math.abs(amount) * 7)
    );
  };

  const openCreate = (
    time: string,
    date = DateTimeManager.toDateKey(anchorDate),
    durationMinutes: number = CALENDAR_TIMELINE.initialDurationMinutes
  ) =>
    setDraft({
      date,
      time,
      doctor: providers[1].id,
      durationMinutes,
    });

  return (
    <>
      <main className="min-h-full bg-background">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6 lg:p-8">
          <header className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 text-xs text-muted-foreground">
                Workspace / Klinik operasyonları
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Randevular
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Ekip kapasitesini, çalışma saatlerini ve ziyaret akışını tek
                takvimde yönetin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AppointmentSettingsSheet />
              <Button size="sm" onClick={() => openCreate('09:00')}>
                <Plus data-icon="inline-start" />
                Yeni randevu
              </Button>
            </div>
          </header>

          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Önceki dönem"
                onClick={() => moveDate(-1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAnchorDate(DateTimeManager.create())}
              >
                Bugün
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sonraki dönem"
                onClick={() => moveDate(1)}
              >
                <ChevronRight />
              </Button>
              <span className="ml-1 text-sm font-medium">{dateLabel}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SelectInput
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                aria-label="Uzman filtresi"
              >
                <option value="">{calendarText('allProviders')}</option>
                {providers.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                  >{`${p.providerTitleId} ${p.userId}`}</option>
                ))}
              </SelectInput>
              <SelectInput
                value={clinic}
                onChange={(event) => setClinic(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                aria-label="Klinik filtresi"
              >
                <option value="">{calendarText('currentClinic')}</option>
                {clinics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </SelectInput>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-9 w-48 pl-9"
                  placeholder="Hasta ara"
                  aria-label="Randevularda ara"
                />
              </div>
              <div className="flex rounded-md border bg-background p-0.5">
                <Button
                  size="sm"
                  variant={range === 'day' ? 'secondary' : 'ghost'}
                  onClick={() => setRange('day')}
                >
                  Gün
                </Button>
                <Button
                  size="sm"
                  variant={range === 'week' ? 'secondary' : 'ghost'}
                  onClick={() => setRange('week')}
                >
                  Hafta
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 border-b">
            <Button
              variant={view === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('calendar')}
            >
              <CalendarDays data-icon="inline-start" />
              Takvim
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List data-icon="inline-start" />
              Liste
            </Button>
            <Button
              variant={view === 'waiting' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('waiting')}
            >
              <Grid2X2 data-icon="inline-start" />
              Bekleme odası
            </Button>
          </div>

          <DataLoadingBoundary
            isLoading={calendarQuery.isLoading}
            label={calendarText('loading')}
            fallback={<AppointmentDataSkeleton view={view} range={range} />}
            hasData={Boolean(calendarQuery.data)}
            offlineFallback={<OfflineDataState />}
          >
            {view === 'calendar' ? (
              <ScheduleGrid
                key={gridDays.map((day) => day.date).join(',')}
                days={gridDays}
                items={visible}
                onRangeConfirm={(selection) =>
                  openCreate(
                    DateTimeManager.minutesToHHMM(selection.startMinute),
                    selection.date,
                    selection.endMinute - selection.startMinute
                  )
                }
                onAppointmentClick={setSelected}
                allowOverbooking={
                  appointmentSettings.data?.data.staffAllowOverbooking ?? false
                }
                resizeEnabled={resizeEnabled}
                onResizeEnabledChange={setResizeEnabled}
                slotDurationMinutes={calendarSlotDurationMinutes}
                onSlotDurationMinutesChange={setCalendarSlotDurationMinutes}
                canResizeAppointments={canResizeAppointments}
                isSaving={resizeAppointment.isPending}
                isRefreshing={calendarQuery.isFetching}
                feedback={feedback}
                onRefresh={() => {
                  if (saveLock.current) return;
                  resizeAppointment.reset();
                  void calendarQuery.refetch();
                }}
                onAppointmentResize={handleAppointmentResize}
              />
            ) : view === 'list' ? (
              <AppointmentList items={visible} onSelect={setSelected} />
            ) : (
              <WaitingRoom
                items={visible.filter(
                  (item) => item.status === AppointmentStatusSchema.enum.ARRIVED
                )}
                onSelect={setSelected}
              />
            )}
          </DataLoadingBoundary>

          <ManagedSheet
            open={Boolean(selected || draft)}
            side="right"
            className="w-full sm:max-w-lg"
            onOpenChange={(open) => {
              if (!open) {
                setSelected(null);
                setDraft(null);
              }
            }}
          >
            <ManagedSheet.Header
              title={
                selected
                  ? selected.patientName ||
                    selected.patientId ||
                    calendarText('patientHidden')
                  : calendarText('createAppointment')
              }
              description={calendarText(
                selected
                  ? 'appointmentDetailsDescription'
                  : 'rangeFormDescription'
              )}
            >
              <ManagedSheet.Settings />
              <ManagedSheet.Close />
            </ManagedSheet.Header>
            <ManagedSheet.Content className="min-h-0 flex-1 overflow-y-auto py-4">
              {selected ? (
                <AppointmentDetails item={selected} />
              ) : (
                <div
                  key={`${draft?.date}-${draft?.time}-${draft?.durationMinutes}`}
                  className="flex flex-col gap-4 px-4 pb-4"
                >
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="font-medium">
                      {draft &&
                        calendarText('selectedRange', {
                          date: draft.date,
                          start: draft.time,
                          end: DateTimeManager.formatDateTime(
                            DateTimeManager.addMinutes(
                              DateTimeManager.fromLocalDateTime(
                                draft.date,
                                draft.time
                              ),
                              draft.durationMinutes
                            )
                          ).split(' ')[1],
                          minutes: draft.durationMinutes,
                        })}
                    </div>
                    <div className="text-muted-foreground">
                      {draft?.doctor} · Europe/Istanbul
                    </div>
                  </div>
                  <Input placeholder="Hasta ara ve seç" aria-label="Hasta" />
                  <Input
                    defaultValue={draft?.time}
                    type="time"
                    step={CALENDAR_TIMELINE.stepMinutes * 60}
                    aria-label={calendarText('startTime')}
                  />
                  <Input
                    defaultValue={draft?.durationMinutes}
                    type="number"
                    min={CALENDAR_TIMELINE.stepMinutes}
                    step={CALENDAR_TIMELINE.stepMinutes}
                    aria-label={calendarText('durationMinutes')}
                  />
                  <Input placeholder="Tedavi" aria-label="Tedavi" />
                  <Button onClick={() => setDraft(null)}>
                    Randevuyu kaydet
                  </Button>
                </div>
              )}
            </ManagedSheet.Content>
          </ManagedSheet>
        </div>
      </main>

      <ManagedSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        title="Yeni kayıt"
      >
        <div className="flex flex-col gap-4 p-5">
          <Input
            placeholder="Ad soyad veya kayıt başlığı"
            aria-label="Kayıt adı"
          />
          <Input placeholder="İletişim bilgisi" aria-label="İletişim bilgisi" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setComposerOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => setComposerOpen(false)}>Kaydet</Button>
          </div>
        </div>
      </ManagedSheet>

      <ManagedSheet
        open={Boolean(selectedRow)}
        onOpenChange={(open) => !open && setSelectedRow(null)}
        title="Kayıt detayları"
      >
        <div className="flex flex-col gap-4 p-5">
          {selectedRow
            ? selectedRow.map((value, index) => (
                <div
                  key={`${value}-${index}`}
                  className="border-b pb-3 text-sm last:border-0"
                >
                  <span className="text-muted-foreground">
                    Alan {index + 1}
                  </span>
                  <div className="font-medium">{value}</div>
                </div>
              ))
            : null}
          {selectedRow?.[0] ? (
            <Button
              className="w-full"
              onClick={() =>
                router.push(
                  `/${params.locale}/${params['organization-slug']}/${params['clinic-slug']}/crm/patient/${selectedRow[0] === 'Elif Yıldız' ? 'elif-yildiz' : 'james-miller'}`
                )
              }
            >
              Hasta profiline git
            </Button>
          ) : null}
        </div>
      </ManagedSheet>
    </>
  );
};

export default AppointmentsPage;
