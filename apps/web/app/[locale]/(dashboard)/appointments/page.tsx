'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Grid2X2, List, Plus, Search, Settings2, } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, } from '@/components/ui/sheet';
import ManagedSheet from '@/components/ui/managed-sheet';
import { WaitingRoom } from './_components/waiting-room';
import { ScheduleGrid } from './_components/schedule-grid';
import { AppointmentList } from './_components/appointment-list';
import { AppointmentDetails } from './_components/appointment-details';

import { appointments, clinics, providers, } from './_components/appointments-workspace';

export type Appointment = {
  time: string;
  patient: string;
  type: string;
  clinic: string;
  doctor: string;
  status: string;
  endTime: string;
};

const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];

const AppointmentsPage = () => {
  const router = useRouter();
  const [view, setView] = React.useState<'calendar' | 'list' | 'waiting'>(
    'calendar'
  );
  const [range, setRange] = React.useState<'day' | 'week'>('day');
  const [provider, setProvider] = React.useState('Tümü');
  const [clinic, setClinic] = React.useState('Tüm klinikler');
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Appointment | null>(null);
  const [draft, setDraft] = React.useState<{
    date: string;
    time: string;
    doctor: string;
  } | null>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<
    readonly string[] | null
  >(null);
  const [anchorDate, setAnchorDate] = React.useState(
    () => new Date(2026, 7, 13)
  );

  const visible = appointments.filter(
    (item) =>
      (provider === 'Tümü' || item.doctor === provider) &&
      (clinic === 'Tüm klinikler' || item.clinic === clinic) &&
      item.patient
        .toLocaleLowerCase('tr')
        .includes(query.toLocaleLowerCase('tr'))
  );
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const shortFormatter = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
  });
  const weekStart = new Date(anchorDate);
  weekStart.setDate(anchorDate.getDate() - ((anchorDate.getDay() + 6) % 7));
  const dateLabel =
    range === 'day'
      ? formatter.format(anchorDate)
      : `${shortFormatter.format(weekStart)}–${shortFormatter.format(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 4))} ${anchorDate.getFullYear()}`;
  const gridDays =
    range === 'day'
      ? [`Bugün · ${shortFormatter.format(anchorDate)}`]
      : dayNames.map(
          (day, index) =>
            `${day} · ${shortFormatter.format(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + index))}`
        );

  const moveDate = (amount: number) =>
    setAnchorDate((current) => {
      const next = new Date(current);
      next.setDate(current.getDate() + (range === 'day' ? amount : amount * 7));
      return next;
    });

  const openCreate = (time: string, doctor = providers[1]) =>
    setDraft({
      date: anchorDate.toLocaleDateString('tr-TR'),
      time,
      doctor,
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
              <Button variant="outline" size="sm">
                <Settings2 data-icon="inline-start" />
                Randevu kuralları
              </Button>
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
                onClick={() => setAnchorDate(new Date(2026, 7, 13))}
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
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                aria-label="Uzman filtresi"
              >
                {providers.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <select
                value={clinic}
                onChange={(event) => setClinic(event.target.value)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
                aria-label="Klinik filtresi"
              >
                {clinics.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
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

          {view === 'calendar' ? (
            <ScheduleGrid
              days={gridDays}
              items={visible}
              onSlotClick={openCreate}
              onAppointmentClick={setSelected}
            />
          ) : view === 'list' ? (
            <AppointmentList items={visible} onSelect={setSelected} />
          ) : (
            <WaitingRoom
              items={visible.filter(
                (item) =>
                  item.status === 'in-progress' || item.status === 'waiting'
              )}
              onSelect={setSelected}
            />
          )}

          <Sheet
            open={Boolean(selected || draft)}
            onOpenChange={(open) => {
              if (!open) {
                setSelected(null);
                setDraft(null);
              }
            }}
          >
            <SheetContent>
              <SheetHeader>
                <SheetTitle>
                  {selected ? selected.patient : 'Yeni randevu'}
                </SheetTitle>
                <SheetDescription>
                  {selected
                    ? 'Randevu detayları ve uygun sonraki aksiyonlar.'
                    : 'Seçtiğiniz zaman aralığı forma önceden aktarıldı.'}
                </SheetDescription>
              </SheetHeader>
              {selected ? (
                <AppointmentDetails item={selected} />
              ) : (
                <div className="flex flex-col gap-4 px-4 pb-4">
                  <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                    <div className="font-medium">
                      {draft?.date} · {draft?.time}
                    </div>
                    <div className="text-muted-foreground">
                      {draft?.doctor} · Europe/Istanbul
                    </div>
                  </div>
                  <Input placeholder="Hasta ara ve seç" aria-label="Hasta" />
                  <Input
                    defaultValue={draft?.time}
                    type="time"
                    aria-label="Başlangıç saati"
                  />
                  <Input
                    defaultValue="60"
                    type="number"
                    aria-label="Süre (dakika)"
                  />
                  <Input placeholder="Tedavi" aria-label="Tedavi" />
                  <Button onClick={() => setDraft(null)}>
                    Randevuyu kaydet
                  </Button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </main>

      <ManagedSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        title="Yeni kayıt"
        description="Gerekli bilgileri girerek çalışma alanınıza yeni kayıt ekleyin."
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
        description="Seçilen kaydın özet bilgileri."
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
                  `../patients/${selectedRow[0] === 'Elif Yıldız' ? 'elif-yildiz' : 'james-miller'}`
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