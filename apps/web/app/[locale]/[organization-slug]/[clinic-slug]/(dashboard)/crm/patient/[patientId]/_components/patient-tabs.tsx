'use client';

import { CalendarDays, CreditCard, FileText, Stethoscope } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, Info, OverviewCard, ProfileSection } from './index';
import { DateTimeManager } from '@shared/common';
import { formatLongDate } from '@/lib/date-time';

export function PatientTabs({
  patient,
  patientAppointments,
}: {
  patient: any;
  patientAppointments: any[];
}) {
  const router = useRouter();
  const params = useParams<{
    locale: string;
    'organization-slug': string;
    'clinic-slug': string;
  }>();
  const appointmentHref = `/${params.locale}/${params['organization-slug']}/${params['clinic-slug']}/clinical/appointment`;

  return (
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
                  <Stethoscope className="me-2 size-4" />
                  Tıbbi kayıt oluştur
                </Button>
                <Button variant="outline" className="justify-start">
                  <CreditCard className="me-2 size-4" />
                  Ödeme al
                </Button>
                <Button variant="outline" className="justify-start">
                  <FileText className="me-2 size-4" />
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
          onAction={() => router.push(appointmentHref)}
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
                      {formatLongDate(item.startTime, params.locale)} ·{' '}
                      {item.time} · {item.doctor}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {item.status === 'confirmed' ? 'Onaylandı' : item.status}
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
            <Info
              label="Son işlem"
              value={formatLongDate(
                DateTimeManager.subtractDays(DateTimeManager.create(), 5),
                params.locale
              )}
            />
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
  );
}
