'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';

import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { useAuth } from '@/data/auth/auth-context';

export function ClinicRouteScope({ children }: { children: React.ReactNode }) {
  const params = useParams<{ locale: string; 'clinic-slug': string }>();
  const router = useRouter();
  const { actor, hasHydrated, selectedClinicId, switchClinic } = useAuth();
  const locale = params.locale ?? 'tr';
  const clinicSlug = params['clinic-slug'];

  React.useEffect(() => {
    if (!hasHydrated) return;

    if (clinicSlug === 'all-clinics') {
      if (actor.managedClinics.length > 1) {
        if (selectedClinicId !== null) switchClinic(null);
        return;
      }
    } else {
      const clinic = clinics.find((item) => item.slug === clinicSlug);
      if (clinic && actor.managedClinics.includes(clinic.id)) {
        if (selectedClinicId !== clinic.id) switchClinic(clinic.id);
        return;
      }
    }

    const fallbackClinic = clinics.find((item) =>
      actor.managedClinics.includes(item.id)
    );
    if (fallbackClinic) {
      router.replace(`/${locale}/${fallbackClinic.slug}`);
    }
  }, [
    actor.managedClinics,
    clinicSlug,
    hasHydrated,
    locale,
    router,
    selectedClinicId,
    switchClinic,
  ]);

  return children;
}
