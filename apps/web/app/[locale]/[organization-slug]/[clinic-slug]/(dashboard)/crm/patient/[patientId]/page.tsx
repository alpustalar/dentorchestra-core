import { Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { appointments } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { patients } from '@/data/patients/patients';
import { PatientTabs } from './_components/patient-tabs';
import { PatientActions } from './_components/patient-actions';

type PatientProfilePageProps = {
  params: Promise<{ patientId: string; locale: string }>;
};

export default async function PatientProfilePage({
  params,
}: PatientProfilePageProps) {
  const { patientId } = await params;

  const t = await getTranslations('patients');

  const patient = patients.find((p) => p.id === patientId) ?? patients[0];

  const patientAppointments = appointments.filter(
    (item) => item.patient === patient.name
  );

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 md:p-6 lg:p-8">
        {/* Üst Navigasyon ve Geri Dön Butonu */}
        <div className="flex items-center gap-3">
          <PatientActions type="back-button" />
          <span className="text-xs text-muted-foreground">
            / {t('profile.breadcrumb')}
          </span>
        </div>

        {/* Hasta Header Kartı */}
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
                  <Badge variant="secondary">
                    {t(`status.${patient.status}`)}
                  </Badge>
                  <Badge variant="outline">
                    {t('profile.typeLabel', {
                      type: t(`type.${patient.type}`),
                    })}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {t('profile.protocol', { number: patient.protocol })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3.5" />
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
                    {t('profile.provider', { name: patient.provider })}
                  </span>
                </div>
              </div>
            </div>

            <PatientActions type="header-actions" />
          </div>
        </section>

        {/* TABLAR VE İNTERAKTİF İÇERİKLER */}
        <PatientTabs
          patient={patient}
          patientAppointments={patientAppointments}
        />
      </div>
    </main>
  );
}
