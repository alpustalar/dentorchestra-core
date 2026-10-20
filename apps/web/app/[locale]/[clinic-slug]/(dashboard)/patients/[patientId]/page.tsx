import { redirect } from 'next/navigation';

type LegacyPatientRouteProps = {
  params: Promise<{
    locale: string;
    'clinic-slug': string;
    patientId: string;
  }>;
};

export default async function LegacyPatientRoute({
  params,
}: LegacyPatientRouteProps) {
  const { locale, 'clinic-slug': clinicSlug, patientId } = await params;
  redirect(`/${locale}/${clinicSlug}/crm/patient/${patientId}`);
}
