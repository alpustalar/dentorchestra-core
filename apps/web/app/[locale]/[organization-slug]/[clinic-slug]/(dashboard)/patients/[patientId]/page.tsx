import { redirect } from 'next/navigation';

type LegacyPatientRouteProps = {
  params: Promise<{
    locale: string;
    'organization-slug': string;
    'clinic-slug': string;
    patientId: string;
  }>;
};

export default async function LegacyPatientRoute({
  params,
}: LegacyPatientRouteProps) {
  const {
    locale,
    'organization-slug': organizationSlug,
    'clinic-slug': clinicSlug,
    patientId,
  } = await params;
  redirect(`/${locale}/${organizationSlug}/${clinicSlug}/crm/patient/${patientId}`);
}
