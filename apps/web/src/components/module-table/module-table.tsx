'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CircleDollarSign,
  Filter,
  Megaphone,
  MessageSquare,
  Package,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import ManagedSheet from '@/components/ui/managed-sheet';

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
} as const;

type ModuleKey = keyof typeof modules;

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

export function ModuleTable({ module }: { module: string }) {
  const router = useRouter();
  const config =
    modules[(module in modules ? module : 'patients') as ModuleKey];
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

type SummaryProps = {
  label: string;
  value: string;
  change: string;
  tone?: 'warning';
};
function Summary({ label, value, change, tone }: SummaryProps) {
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
