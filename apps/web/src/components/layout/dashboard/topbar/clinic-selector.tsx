'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/data/auth/auth-context';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { organizations } from '@/features/organization/organization/data/mock-organization';

export function ClinicSelector() {
  const { actor, selectedClinicId, switchClinic } = useAuth();
  const params = useParams<{
    locale: string;
    'organization-slug': string;
    'clinic-slug': string;
  }>();
  const pathname = usePathname();
  const router = useRouter();
  const locale = params.locale ?? 'tr';
  const organizationSlug = params['organization-slug'] ?? 'as-yazilim';
  const currentSlug = params['clinic-slug'] ?? 'fethiye';
  const managedClinics = actor?.managedClinics ?? [];
  const [open, setOpen] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  const organizationId = organizations.find(
    (organization) => organization.slug === organizationSlug
  )?.id;
  const selectableClinics = managedClinics.flatMap((id) => {
    const clinic = clinics.find(
      (item) => item.id === id && item.organizationId === organizationId
    );
    return clinic ? [{ id: clinic.id, name: clinic.name }] : [];
  });

  if (selectableClinics.length < 2) return null;
  const currentClinic = selectableClinics.find(
    (clinic) => clinic.id === selectedClinicId
  );
  const displayName = currentClinic?.name ?? selectableClinics[0].name;

  const navigateToClinic = (clinicId: string, clinicSlug: string) => {
    switchClinic(clinicId);
    setOpen(false);

    const currentPrefix = `/${locale}/${organizationSlug}/${currentSlug}`;
    const modulePath = pathname.startsWith(currentPrefix)
      ? pathname.slice(currentPrefix.length)
      : '';
    router.push(`/${locale}/${organizationSlug}/${clinicSlug}${modulePath}`);
  };

  return (
    <div ref={selectorRef} className="relative ml-2 shrink-0">
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
