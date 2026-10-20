'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useAuth } from '@/data/auth/auth-context';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';

export function ClinicSelector() {
  const t = useTranslations();
  const { actor, selectedClinicId, switchClinic } = useAuth();
  const params = useParams<{ locale: string; 'clinic-slug': string }>();
  const pathname = usePathname();
  const router = useRouter();
  const locale = params.locale ?? 'tr';
  const currentSlug = params['clinic-slug'] ?? 'fethiye';
  const managedClinics = actor?.managedClinics ?? [];
  const [open, setOpen] = useState(false);

  if (managedClinics.length < 2) return null;

  const selectableClinics = managedClinics.map((id) => ({
    id,
    name: clinics.find((clinic) => clinic.id === id)?.name ?? id,
  }));
  const currentClinic = selectableClinics.find(
    (clinic) => clinic.id === selectedClinicId
  );
  const displayName = currentClinic?.name ?? t('Common.allClinics');

  const navigateToClinic = (clinicId: string | null, clinicSlug: string) => {
    switchClinic(clinicId);
    setOpen(false);

    const currentPrefix = `/${locale}/${currentSlug}`;
    const modulePath = pathname.startsWith(currentPrefix)
      ? pathname.slice(currentPrefix.length)
      : '';
    router.push(`/${locale}/${clinicSlug}${modulePath}`);
  };

  return (
    <div className="relative ml-2 shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted cursor-pointer transition-colors"
      >
        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
        <span className="truncate">{displayName}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 w-56 overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            onClick={() => {
              navigateToClinic(null, 'all-clinics');
            }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors text-left',
              selectedClinicId === null
                ? 'font-medium text-primary bg-muted/50'
                : 'text-popover-foreground'
            )}
          >
            {t('Common.allClinics')}
          </button>

          <div className="my-1 h-px bg-border" />

          {selectableClinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => {
                navigateToClinic(
                  clinic.id,
                  clinics.find((item) => item.id === clinic.id)?.slug ?? clinic.id
                );
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted cursor-pointer transition-colors text-left',
                clinic.id === selectedClinicId
                  ? 'font-medium text-primary bg-muted/50'
                  : 'text-popover-foreground'
              )}
            >
              {clinic.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
