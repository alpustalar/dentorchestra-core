'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';

import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { organizations } from '@/features/organization/organization/data/mock-organization';
import { useAuth } from '@/data/auth/auth-context';

export function ClinicRouteScope({ children }: { children: React.ReactNode }) {
  const params = useParams<{
    locale: string;
    'organization-slug': string;
    'clinic-slug': string;
  }>();
  const router = useRouter();
  const { actor, hasHydrated, selectedClinicId, switchClinic } = useAuth();
  const locale = params.locale ?? 'tr';
  const organizationSlug = params['organization-slug'];
  const clinicSlug = params['clinic-slug'];

  React.useEffect(() => {
    if (!hasHydrated) return;

    const canAccessClinic = (clinicId: string) =>
      actor.clinicId === clinicId || actor.managedClinics.includes(clinicId);
    const canAccessOrganization = (organizationId: string) =>
      actor.organizationId === organizationId ||
      actor.ownedOrganizations.includes(organizationId);

    const organization = organizations.find(
      (item) => item.slug === organizationSlug
    );
    const clinic = clinics.find((item) => item.slug === clinicSlug);
    if (
      organization &&
      canAccessOrganization(organization.id) &&
      clinic?.organizationId === organization.id &&
      canAccessClinic(clinic.id)
    ) {
      if (selectedClinicId !== clinic.id) switchClinic(clinic.id);
      return;
    }

    const fallbackClinic = clinics.find(
      (item) =>
        canAccessClinic(item.id) && canAccessOrganization(item.organizationId)
    );
    const fallbackOrganization = organizations.find(
      (item) => item.id === fallbackClinic?.organizationId
    );
    if (fallbackClinic && fallbackOrganization) {
      router.replace(
        `/${locale}/${fallbackOrganization.slug}/${fallbackClinic.slug}`
      );
    }
  }, [
    actor.clinicId,
    actor.managedClinics,
    actor.organizationId,
    actor.ownedOrganizations,
    clinicSlug,
    hasHydrated,
    locale,
    organizationSlug,
    router,
    selectedClinicId,
    switchClinic,
  ]);

  return children;
}
