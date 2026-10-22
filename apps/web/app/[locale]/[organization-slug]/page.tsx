import { redirect } from 'next/navigation';

import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { organizations } from '@/features/organization/organization/data/mock-organization';

type OrganizationPageProps = {
  params: Promise<{
    locale: string;
    'organization-slug': string;
  }>;
};

export default async function OrganizationIndexPage({
  params,
}: OrganizationPageProps) {
  const { locale, 'organization-slug': organizationSlug } = await params;
  const organization = organizations.find(
    (item) => item.slug === organizationSlug
  );
  const clinic = clinics.find(
    (item) => item.organizationId === organization?.id && !item.isPlatform
  );

  if (!organization || !clinic) redirect(`/${locale}`);
  redirect(`/${locale}/${organization.slug}/${clinic.slug}`);
}
