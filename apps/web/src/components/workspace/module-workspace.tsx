'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Filter,
  Grid2X2,
  List,
  Megaphone,
  MessageSquare,
  Package,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Users,
} from 'lucide-react';
import { appointments as sourceAppointments } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ManagedSheet from '@/components/ui/managed-sheet';
import { PatientLink } from '@/features/crm/patient/components/patient-link';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const modules = {
  patients: {
    title: 'Hastalar',
    description:
      'Hasta dizinini, ziyaret geçmişini ve takip aksiyonlarını yönetin.',
    icon: Users,
    action: 'Yeni hasta',
    columns: ['Hasta', 'İletişim', 'Son ziyaret', 'Sonraki randevu', 'Durum'],
    rows: [
      ['Elif Yıldız', '0532 481 22 18', '08 Ağu 2026', '12 Ağu 2026', 'Aktif'],
      [
        'James Miller',
        '+44 20 7946 0912',
        '07 Ağu 2026',
        '14 Ağu 2026',
        'Tedavi sürüyor',
      ],
      ['Ayşe Korkmaz', '0555 209 45 61', '02 Ağu 2026', '—', 'Takipte'],
    ],
  },
  inventory: {
    title: 'Envanter',
    description:
      'Kritik stokları, tedarikçileri ve satın alma süreçlerini izleyin.',
    icon: Package,
    action: 'Ürün ekle',
    columns: ['SKU', 'Ürün', 'Kategori', 'Mevcut stok', 'Minimum', 'Durum'],
    rows: [
      [
        'IMP-400',
        'Titanyum implant 4.0mm',
        'Dental',
        '12 adet',
        '30 adet',
        'Kritik',
      ],
      ['LID-002', 'Lidokain %2 ampul', 'Sarf', '24 adet', '50 adet', 'Düşük'],
      [
        'HY-001',
        'Hyaluronik dolgu 1ml',
        'Estetik',
        '42 kutu',
        '15 kutu',
        'Yeterli',
      ],
    ],
  },
  finance: {
    title: 'Finans',
    description:
      'Gelir, tahsilat ve açık bakiyeleri güvenilir bir görünümle takip edin.',
    icon: CircleDollarSign,
    action: 'Fatura oluştur',
    columns: ['Belge', 'Müşteri', 'Tarih', 'Tutar', 'Durum'],
    rows: [
      ['FTR-2026-184', 'Elif Yıldız', '08 Ağu 2026', '₺42.500', 'Ödendi'],
      ['FTR-2026-183', 'James Miller', '07 Ağu 2026', '€2.400', 'Bekliyor'],
      ['FTR-2026-182', 'Sofia Rossi', '05 Ağu 2026', '€4.200', 'Kısmi'],
    ],
  },
  crm: {
    title: 'CRM',
    description: 'İlişkileri, fırsatları ve takip görevlerini görünür kılın.',
    icon: Users,
    action: 'Yeni kişi',
    columns: ['Kişi', 'Kaynak', 'Aşama', 'Son temas', 'Sorumlu'],
    rows: [
      ['Lucia Fernández', 'Meta Ads', 'Teklif', 'Bugün', 'Zeynep Ak'],
      ['Ahmed Hassan', 'WhatsApp', 'Konsültasyon', 'Dün', 'Mert Kaya'],
      ['Sofia Rossi', 'Referans', 'Kazanıldı', '05 Ağu', 'Zeynep Ak'],
    ],
  },
  marketing: {
    title: 'Marketing & Advertising',
    description:
      'Kampanya performansını, harcamayı ve dönüşümü birlikte değerlendirin.',
    icon: Megaphone,
    action: 'Kampanya oluştur',
    columns: ['Kampanya', 'Kanal', 'Lead', 'Harcama', 'Dönüşüm'],
    rows: [
      ['Yaz Saç Ekimi', 'Meta Ads', '148', '₺62.000', '%8,1'],
      ['Dental Avrupa', 'Google Ads', '96', '₺54.000', '%6,4'],
      ['Referans Programı', 'Organik', '33', '—', '%12,2'],
    ],
  },
  inbox: {
    title: 'Omnichannel Inbox',
    description:
      'WhatsApp, SMS ve e-posta görüşmelerini tek, güvenli çalışma alanında yönetin.',
    icon: MessageSquare,
    action: 'Yeni mesaj',
    columns: ['Kanal', 'Müşteri', 'Son mesaj', 'Atanan', 'Durum'],
    rows: [
      ['WhatsApp', 'Ayhan Karan', 'Saat 3e olsun', 'Zeynep Ak', 'Açık'],
      [
        'Instagram',
        'Lucia Fernández',
        'Precio de rinoplastia?',
        'Mert Kaya',
        'Yanıt bekliyor',
      ],
    ],
  },
  workforce: {
    title: 'HR & Workforce',
    description:
      'Ekip, vardiya ve izin süreçlerini rol bazlı görünürlükle yönetin.',
    icon: BriefcaseBusiness,
    action: 'Çalışan ekle',
    columns: ['Çalışan', 'Departman', 'Rol', 'Bugünkü durum', 'İzin bakiyesi'],
    rows: [
      ['Zeynep Ak', 'Yönetim', 'Klinik yöneticisi', 'Çalışıyor', '14 gün'],
      ['Dr. Kaya', 'Dental', 'Uzman hekim', 'Randevuda', '8 gün'],
    ],
  },
  automations: {
    title: 'AI & Automations',
    description:
      'Tekrarlayan işleri otomatikleştirin; her öneriyi insan onayıyla güvenle uygulayın.',
    icon: Sparkles,
    action: 'Otomasyon oluştur',
    columns: ['Otomasyon', 'Tetikleyici', 'Son çalıştırma', 'Sonuç', 'Durum'],
    rows: [
      [
        'Randevu hatırlatıcı',
        '24 saat kala',
        'Bugün 08:00',
        '42 mesaj',
        'Aktif',
      ],
      [
        'Düşük stok uyarısı',
        'Stok minimum altı',
        'Dün 16:30',
        '3 uyarı',
        'Aktif',
      ],
    ],
  },
} as const;

type ModuleKey = keyof typeof modules;
type Appointment = {
  id: string;
  time: string;
  patient: string;
  type: string;
  clinic: string;
  doctor: string;
  status: string;
  endTime: string;
  date: string;
  patientDetail: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    tcNo: string | null;
  };
  providerDetail: {
    id: string;
    title: string | null;
    specialty: string | null;
    user: { id: string; displayName: string | null } | null;
    publicPhone: string | null;
    publicEmail: string | null;
  };
  treatmentDetail?: {
    id: string;
    slug: string;
    duration: number | null;
    sutCode: string | null;
  };
  clinicDetail: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    phone: string | null;
    address: string | null;
  };
};
const providers = [
  'Tümü',
  ...Array.from(new Set(sourceAppointments.map((item) => item.doctor))),
];
const clinics = [
  'Tüm klinikler',
  ...Array.from(new Set(sourceAppointments.map((item) => item.clinic))),
];
const statusLabels: Record<string, string> = {
  confirmed: 'Onaylandı',
  'in-progress': 'Devam ediyor',
  waiting: 'Bekliyor',
  cancelled: 'İptal',
};
const statusVariant = (value: string) =>
  [
    'Aktif',
    'Onaylandı',
    'Ödendi',
    'Yeterli',
    'Kazanıldı',
    'Çalışıyor',
  ].includes(value)
    ? ('secondary' as const)
    : ('outline' as const);
const appointmentStatus = (value: string) =>
  value === 'confirmed'
    ? ('secondary' as const)
    : value === 'cancelled'
      ? ('destructive' as const)
      : ('outline' as const);
const hours = Array.from(
  { length: 12 },
  (_, index) => `${String(index + 8).padStart(2, '0')}:00`
);
const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum'];
const appointments: Appointment[] = sourceAppointments.map((item, index) => {
  const patientNames = item.patient.split(' ');
  const firstName = patientNames.shift() ?? item.patient;
  const lastName = patientNames.join(' ') || null;
  return {
    ...item,
    id: `apt-${index + 1}`,
    date: '2026-08-13',
    endTime:
      index === 2
        ? '11:15'
        : `${String(Number(item.time.slice(0, 2)) + 1).padStart(2, '0')}:${item.time.slice(3)}`,
    patientDetail: {
      id: `patient-${index + 1}`,
      firstName,
      lastName,
      phone:
        index === 0
          ? '0532 481 22 18'
          : index === 1
            ? '+44 20 7946 0912'
            : '0555 209 45 61',
      email: index === 0 ? 'elif.yildiz@example.com' : null,
      tcNo: index === 0 ? '12345678901' : null,
    },
    providerDetail: {
      id: `provider-${index + 1}`,
      title: item.doctor.startsWith('Dr.') ? 'Dr.' : 'Op. Dr.',
      specialty: item.type.includes('İmplant')
        ? 'Diş Hekimliği'
        : item.type.includes('Saç')
          ? 'Plastik Cerrahi'
          : 'Estetik Cerrahi',
      user: { id: `user-${index + 1}`, displayName: item.doctor },
      publicPhone: null,
      publicEmail: null,
    },
    treatmentDetail: {
      id: `treatment-${index + 1}`,
      slug: item.type.toLocaleLowerCase('tr').replaceAll(' ', '-'),
      duration: index === 2 ? 60 : 45,
      sutCode: null,
    },
    clinicDetail: {
      id: `clinic-${index + 1}`,
      name: item.clinic,
      slug: item.clinic.toLocaleLowerCase('tr').replaceAll(' ', '-'),
      timezone: 'Europe/Istanbul',
      phone: '+90 212 555 10 10',
      address: 'Levent, İstanbul',
    },
  };
});

export function ModuleWorkspace({ module }: { module: string }) {
  if (module === 'appointments') return <AppointmentsWorkspace />;
  if (module === 'inbox') return <ChatWorkspace />;
  const config =
    modules[(module in modules ? module : 'patients') as ModuleKey];
  const router = useRouter();
  const [query, setQuery] = React.useState('');
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [selectedRow, setSelectedRow] = React.useState<
    readonly string[] | null
  >(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('Tümü');
  const Icon = config.icon;
  const statuses = Array.from(
    new Set(config.rows.map((row) => row[row.length - 1]))
  );
  const rows = config.rows.filter(
    (row) =>
      row
        .join(' ')
        .toLocaleLowerCase('tr')
        .includes(query.toLocaleLowerCase('tr')) &&
      (statusFilter === 'Tümü' || row[row.length - 1] === statusFilter)
  );
  return (
    <>
      <main className="min-h-full bg-background">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6 lg:p-8">
          <header className="flex flex-col gap-4 border-b border-border/70 pb-6 md:flex-row md:items-end md:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon aria-hidden="true" />
              </div>
              <div>
                <div className="mb-2 text-xs text-muted-foreground">
                  Workspace / {config.title}
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  {config.title}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {config.description}
                </p>
              </div>
            </div>
            <Button onClick={() => setComposerOpen(true)}>
              <Plus data-icon="inline-start" />
              {config.action}
            </Button>
          </header>
          <section className="grid gap-3 sm:grid-cols-3">
            <Summary
              label="Toplam kayıt"
              value={
                module === 'finance'
                  ? '₺4,82M'
                  : module === 'inventory'
                    ? '284 ürün'
                    : '1.284'
              }
              change="Son 30 güne göre"
            />
            <Summary
              label="Aksiyon bekleyen"
              value="18"
              change="Öncelikli kayıt"
              tone="warning"
            />
            <Summary label="Bu hafta" value="47 işlem" change="Planlanan" />
          </section>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-col gap-4 border-b bg-muted/20 pb-4 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Kayıtlar</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[220px]">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Kayıtlarda ara..."
                    className="pl-9"
                    aria-label="Kayıtlarda ara"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterOpen((open) => !open)}
                >
                  <Filter data-icon="inline-start" />
                  Filtrele
                </Button>
              </div>
              {filterOpen && (
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    variant={statusFilter === 'Tümü' ? 'secondary' : 'ghost'}
                    onClick={() => setStatusFilter('Tümü')}
                  >
                    Tümü
                  </Button>
                  {statuses.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={statusFilter === status ? 'secondary' : 'ghost'}
                      onClick={() => setStatusFilter(status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/20 text-left text-xs text-muted-foreground">
                  <tr>
                    {config.columns.map((column) => (
                      <th key={column} className="px-5 py-3 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.join('-')}
                      className="cursor-pointer border-t transition-colors hover:bg-muted/20"
                      onClick={() => setSelectedRow(row)}
                    >
                      {row.map((cell, index) => (
                        <td key={`${cell}-${index}`} className="px-5 py-4">
                          {index === row.length - 1 ? (
                            <Badge variant={statusVariant(cell)}>{cell}</Badge>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
        <Sheet
          open={Boolean(selectedRow || composerOpen)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedRow(null);
              setComposerOpen(false);
            }
          }}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>
                {selectedRow ? selectedRow[0] : config.action}
              </SheetTitle>
              <SheetDescription>
                {selectedRow
                  ? 'Kayıt detaylarını ve sonraki aksiyonları inceleyin.'
                  : `${config.title} çalışma alanına yeni kayıt ekleyin.`}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4 pb-4">
              {selectedRow ? (
                selectedRow.map((cell, index) => (
                  <div
                    key={`${cell}-${index}`}
                    className="flex items-center justify-between gap-4 border-b pb-3 text-sm"
                  >
                    <span className="text-muted-foreground">
                      {config.columns[index]}
                    </span>
                    <span className="text-right font-medium">{cell}</span>
                  </div>
                ))
              ) : (
                <>
                  <Input placeholder="Kayıt adı" aria-label="Kayıt adı" />
                  <Input
                    placeholder="Not veya açıklama"
                    aria-label="Not veya açıklama"
                  />
                  <Button onClick={() => setComposerOpen(false)}>Kaydet</Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
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
}

function ChatWorkspace() {
  const [channel, setChannel] = React.useState('Tümü');
  const [selected, setSelected] = React.useState('Ayhan Karan');
  const [message, setMessage] = React.useState('');
  const [sent, setSent] = React.useState<string[]>([]);
  const conversations = [
    {
      name: 'Ayhan Karan',
      channel: 'WhatsApp',
      time: '3 dk',
      preview: 'Saat 3e olsun',
      unread: 2,
      tone: 'bg-chart-5/15 text-chart-5',
    },
    {
      name: 'Lucia Fernández',
      channel: 'Instagram',
      time: '18 dk',
      preview: 'Precio de rinoplastia?',
      unread: 1,
      tone: 'bg-chart-4/15 text-chart-4',
    },
    {
      name: 'Sofia Rossi',
      channel: 'E-posta',
      time: '1 sa',
      preview: 'Teklif dokümanını ilettim.',
      unread: 0,
      tone: 'bg-muted text-muted-foreground',
    },
  ];
  const active =
    conversations.find((item) => item.name === selected) ?? conversations[0];
  const visible =
    channel === 'Tümü'
      ? conversations
      : conversations.filter((item) => item.channel === channel);
  const sendMessage = () => {
    if (!message.trim()) return;
    setSent((items) => [...items, message.trim()]);
    setMessage('');
  };
  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5 p-4 md:p-6 lg:p-8">
        <header className="flex flex-col gap-3 border-b border-border/70 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 text-xs text-muted-foreground">
              Workspace / İletişim
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Omnichannel Inbox
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              WhatsApp, Instagram, Facebook ve e-posta görüşmelerini tek çalışma
              alanında yönetin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings2 data-icon="inline-start" />
              Gelen kutusu ayarları
            </Button>
            <Badge variant="secondary">3 açık görüşme</Badge>
          </div>
        </header>
        <section className="grid min-h-[620px] overflow-hidden rounded-xl border bg-card lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <div className="text-sm font-semibold">Görüşmeler</div>
                <div className="text-xs text-muted-foreground">
                  Tüm kanallar
                </div>
              </div>
              <Button size="icon" variant="ghost" aria-label="Yeni görüşme">
                <Plus />
              </Button>
            </div>
            <div className="flex gap-1 overflow-auto border-b p-2">
              <Button
                size="sm"
                variant={channel === 'Tümü' ? 'secondary' : 'ghost'}
                onClick={() => setChannel('Tümü')}
              >
                Tümü
              </Button>
              {['WhatsApp', 'Instagram', 'E-posta'].map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={channel === item ? 'secondary' : 'ghost'}
                  onClick={() => setChannel(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            <div className="flex flex-col">
              {visible.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  onClick={() => setSelected(item.name)}
                  className={cn(
                    'flex items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50',
                    selected === item.name && 'bg-primary/5'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                      item.tone
                    )}
                  >
                    {item.channel.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {item.time}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {item.preview}
                    </span>
                  </span>
                  {item.unread ? (
                    <Badge className="size-5 justify-center rounded-full p-0 text-[10px]">
                      {item.unread}
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </aside>
          <section className="flex min-h-[620px] flex-col">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <div className="text-sm font-semibold">{active.name}</div>
                <div className="text-xs text-muted-foreground">
                  {active.channel} · Yanıt bekliyor
                </div>
              </div>
              <Button variant="outline" size="sm">
                Kişi profili
              </Button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-auto bg-muted/10 p-5">
              <div className="max-w-[76%] self-start rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm">
                <div className="mb-1 text-[11px] font-medium text-muted-foreground">
                  {active.name} · bugün 14:32
                </div>
                {active.preview}
              </div>
              <div className="max-w-[76%] self-end rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground">
                <div className="mb-1 text-[11px] opacity-70">
                  Zeynep · bugün 14:35
                </div>
                Merhaba, size yardımcı olmaktan memnuniyet duyarım.
              </div>
              {sent.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="max-w-[76%] self-end rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
            <div className="border-t bg-card p-3">
              <div className="flex items-end gap-2 rounded-lg border bg-background p-2">
                <Button variant="ghost" size="icon" aria-label="Dosya ekle">
                  <Paperclip />
                </Button>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing &&
                      event.keyCode !== 229
                    ) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Mesajınızı yazın..."
                  className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                  aria-label="Mesajınızı yazın"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  aria-label="Mesaj gönder"
                >
                  <Send />
                </Button>
              </div>
              <div className="mt-2 px-2 text-[11px] text-muted-foreground">
                Enter gönderir · Shift + Enter yeni satır
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function AppointmentsWorkspace() {
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
}

function ScheduleGrid({
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

function AppointmentList({
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

function WaitingRoom({
  items,
  onSelect,
}: {
  items: Appointment[];
  onSelect: (item: Appointment) => void;
}) {
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

function AppointmentDetails({ item }: { item: Appointment }) {
  const patient = item.patientDetail;
  const provider = item.providerDetail;
  const clinic = item.clinicDetail;
  const treatment = item.treatmentDetail;
  return (
    <div className="flex flex-col gap-4 px-4 pb-4 text-sm">
      <div className="rounded-xl border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">
              {patient.firstName} {patient.lastName}
            </div>
            <div className="mt-1 text-muted-foreground">
              {item.date} · {item.time}–{item.endTime} · {clinic.timezone}
            </div>
          </div>
          <Badge variant={appointmentStatus(item.status)}>
            {statusLabels[item.status] ?? item.status}
          </Badge>
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hasta
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Telefon', patient.phone],
            ['E-posta', patient.email],
            ['TC kimlik', patient.tcNo],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 font-medium">{value ?? '—'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Doktor ve tedavi
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['Doktor', provider.user?.displayName ?? provider.title],
            ['Uzmanlık', provider.specialty],
            ['Tedavi', treatment?.slug ?? item.type],
            [
              'Süre',
              treatment?.duration ? `${treatment.duration} dakika` : '—',
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 font-medium">{value ?? '—'}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Klinik
        </div>
        <div className="font-medium">{clinic.name}</div>
        <div className="mt-1 text-muted-foreground">
          {clinic.address ?? '—'}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {clinic.phone ?? 'Telefon bilgisi yok'}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm">
          Düzenle
        </Button>
        <Button size="sm">Check-in yap</Button>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  change,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  tone?: 'warning';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="text-2xl font-semibold tracking-tight">{value}</div>
          <ArrowUpRight
            aria-hidden="true"
            className={
              tone === 'warning' ? 'text-amber-600' : 'text-emerald-600'
            }
          />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{change}</div>
      </CardContent>
    </Card>
  );
}

export { modules };
export default ModuleWorkspace;
