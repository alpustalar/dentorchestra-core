import { redirect } from 'next/navigation';

import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { organizations } from '@/features/organization/organization/data/mock-organization';

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocaleIndexPage({ params }: LocalePageProps) {
  const { locale } = await params;
  const clinic = clinics.find((item) => !item.isPlatform) ?? clinics[0];
  const organization = organizations.find(
    (item) => item.id === clinic.organizationId
  );

  redirect(`/${locale}/${organization?.slug ?? 'as-yazilim'}/${clinic.slug}`);
}
