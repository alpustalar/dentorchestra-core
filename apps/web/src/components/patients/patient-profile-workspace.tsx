'use client';

import * as React from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  FileText,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Stethoscope,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { appointments } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const patients = {
  'elif-yildiz': {
    name: 'Elif Yıldız',
    initials: 'EY',
    protocol: 'MD-2026-0184',
    status: 'ACTIVE',
    type: 'ACTIVE',
    phone: '0532 481 22 18',
    email: 'elif.yildiz@example.com',
    provider: 'Dr. Kaya',
    group: 'Dental Premium',
    groupColor: '#7c83fd',
    birthDate: '14 Mayıs 1988',
    gender: 'Kadın',
    bloodType: 'A Rh+',
    tcNo: '•••••••••42',
    address: 'Nilüfer, Bursa',
    allergies: 'Penisilin',
    chronicDiseases: 'Yok',
    checkupDate: '12 Ağustos 2026',
  },
  'james-miller': {
    name: 'James Miller',
    initials: 'JM',
    protocol: 'MD-2026-0183',
    status: 'ACTIVE',
    type: 'POTENTIAL',
    phone: '+44 20 7946 0912',
    email: 'james.miller@example.com',
    provider: 'Op. Dr. Demir',
    group: 'International',
    groupColor: '#33b5ae',
    birthDate: '22 Eylül 1981',
    gender: 'Erkek',
    bloodType: 'O Rh+',
    tcNo: 'Gizli',
    address: 'London, United Kingdom',
    allergies: 'Bilinmiyor',
    chronicDiseases: 'Yok',
    checkupDate: '14 Ağustos 2026',
  },
} as const;

const labels: Record<string, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
  ARCHIVED: 'Arşivlendi',
  DECEASED: 'Vefat',
  BLACKLISTED: 'Kara liste',
  POTENTIAL: 'Potansiyel',
  PASSIVE: 'Pasif',
  ACTIVE_TYPE: 'Aktif',
};

export function PatientProfileWorkspace({ patientId }: { patientId: string }) {
  const router = useRouter();
  const patient =
    patients[patientId as keyof typeof patients] ?? patients['elif-yildiz'];
  const patientAppointments = appointments.filter(
    (item) => item.patient === patient.name
  );
  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6 lg:p-8">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('../patients')}
          >
            <ArrowLeft data-icon="inline-start" />
            Hastalara dön
          </Button>
          <span className="text-xs text-muted-foreground">/ Hasta profili</span>
        </div>
        <section className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {patient.initials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {patient.name}
                  </h1>
                  <Badge variant="secondary">{labels[patient.status]}</Badge>
                  <Badge variant="outline">Tip: {labels[patient.type]}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>Protokol: {patient.protocol}</span>
                  <span className="inline-flex items-center gap-1">
                    <Phone />
                    {patient.phone}
                  </span>
                  <span>{patient.email}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `${patient.groupColor}22`,
                      color: patient.groupColor,
                    }}
                  >
                    {patient.group}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Sorumlu: {patient.provider}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push('../appointments')}>
                <CalendarDays data-icon="inline-start" />
                Randevu oluştur
              </Button>
              <Button variant="outline">
                <Pencil data-icon="inline-start" />
                Bilgileri düzenle
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Daha fazla hasta işlemi"
              >
                <MoreHorizontal />
              </Button>
            </div>
          </div>
        </section>
        <Tabs defaultValue="overview" className="flex flex-col gap-5">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
            <TabsTrigger value="appointments">Randevular</TabsTrigger>
            <TabsTrigger value="clinical">Tıbbi Kayıtlar</TabsTrigger>
            <TabsTrigger value="finance">Finans</TabsTrigger>
            <TabsTrigger value="documents">Belgeler ve Onamlar</TabsTrigger>
            <TabsTrigger value="personal">Kişisel Bilgiler</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="grid gap-5 md:grid-cols-2">
                <OverviewCard
                  icon={CalendarDays}
                  title="Yaklaşan randevu"
                  value={
                    patientAppointments[0]
                      ? `${patientAppointments[0].time} · ${patientAppointments[0].type}`
                      : 'Planlanmış randevu yok'
                  }
                  detail={
                    patientAppointments[0]
                      ? patientAppointments[0].doctor
                      : 'Yeni randevu oluşturun'
                  }
                />
                <OverviewCard
                  icon={Stethoscope}
                  title="Son klinik aktivite"
                  value={
                    patientAppointments.length
                      ? patientAppointments[0].type
                      : 'Kayıt bulunmuyor'
                  }
                  detail="Mevcut kayıtlardan özetlenir"
                />
                <OverviewCard
                  icon={CreditCard}
                  title="Finans özeti"
                  value="₺42.500"
                  detail="Ödenen toplam · yetki dahilinde"
                />
                <OverviewCard
                  icon={FileText}
                  title="Tedavi paketi"
                  value="İmplant Tedavisi"
                  detail="2 / 5 ziyaret tamamlandı"
                />
              </div>
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Klinik uyarılar</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <div className="font-medium">Alerji kaydı</div>
                      <div className="mt-1 text-muted-foreground">
                        {patient.allergies}
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="font-medium">Kronik hastalık</div>
                      <div className="mt-1 text-muted-foreground">
                        {patient.chronicDiseases}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hızlı işlemler</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <Button variant="outline" className="justify-start">
                      <Stethoscope data-icon="inline-start" />
                      Tıbbi kayıt oluştur
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <CreditCard data-icon="inline-start" />
                      Ödeme al
                    </Button>
                    <Button variant="outline" className="justify-start">
                      <FileText data-icon="inline-start" />
                      Belge ekle
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="appointments">
            <ProfileSection
              title="Randevular"
              action="Randevu oluştur"
              onAction={() => router.push('../appointments')}
            >
              <div className="grid gap-3">
                {patientAppointments.length ? (
                  patientAppointments.map((item) => (
                    <div
                      key={`${item.time}-${item.type}`}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <div className="font-medium">{item.type}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          13 Ağustos 2026 · {item.time} · {item.doctor}
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {item.status === 'confirmed'
                          ? 'Onaylandı'
                          : item.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <EmptyState text="Bu hastaya ait randevu kaydı bulunmuyor." />
                )}
              </div>
            </ProfileSection>
          </TabsContent>
          <TabsContent value="clinical">
            <ProfileSection title="Tıbbi kayıtlar" action="Tıbbi kayıt oluştur">
              <div className="grid gap-4 md:grid-cols-3">
                <Info label="Kan grubu" value={patient.bloodType} />
                <Info label="Alerjiler" value={patient.allergies} />
                <Info label="Kontrol tarihi" value={patient.checkupDate} />
              </div>
              <EmptyState text="Henüz ayrıntılı klinik kayıt eklenmemiş." />
            </ProfileSection>
          </TabsContent>
          <TabsContent value="finance">
            <ProfileSection title="Finans">
              <div className="grid gap-4 md:grid-cols-3">
                <Info label="Toplam tahsilat" value="₺42.500" />
                <Info label="Açık bakiye" value="₺18.000" />
                <Info label="Son işlem" value="08 Ağustos 2026" />
              </div>
              <EmptyState text="Finans hareketleri mevcut backend bağlantısı üzerinden burada listelenir." />
            </ProfileSection>
          </TabsContent>
          <TabsContent value="documents">
            <ProfileSection title="Belgeler ve onamlar" action="Belge ekle">
              <EmptyState text="Bu hastaya ait belge veya onam kaydı bulunmuyor." />
            </ProfileSection>
          </TabsContent>
          <TabsContent value="personal">
            <ProfileSection title="Kişisel bilgiler" action="Bilgileri düzenle">
              <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
                {[
                  ['Ad soyad', patient.name],
                  ['TC kimlik no', patient.tcNo],
                  ['Doğum tarihi', patient.birthDate],
                  ['Cinsiyet', patient.gender],
                  ['Telefon', patient.phone],
                  ['E-posta', patient.email],
                  ['Adres', patient.address],
                  ['Acil durum kişisi', 'Kayıt bulunmuyor'],
                ].map(([label, value]) => (
                  <Info key={label} label={label} value={value} />
                ))}
              </div>
            </ProfileSection>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function OverviewCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-32 flex-col justify-between p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon />
          {title}
        </div>
        <div>
          <div className="mt-4 font-semibold">{value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSection({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {action ? (
          <Button variant="outline" size="sm" onClick={onAction}>
            <Plus data-icon="inline-start" />
            {action}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
