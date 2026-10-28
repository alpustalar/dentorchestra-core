'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { GetPatients, PaginationInput } from '@dentorchestra/shared/client';

import type { PatientStatus } from '../patient.types';

const PAGE_SIZE = 20;

export interface PatientListParams {
  filter: GetPatients;
  pagination: PaginationInput;
}

/**
 * Arama burada `pagination.search` DEĞİL, filtrenin kendi `search` alanı:
 * `paginate` helper'ı tek kolonda arıyor, oysa resepsiyon hastayı ada, soyada,
 * telefona veya protokol numarasına göre arıyor — o çok-kolonlu arama repo'da
 * kurulu ve filtre üzerinden besleniyor.
 */
export function usePatientListParams(clinicId: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<PatientListParams>(() => {
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const scope = searchParams.get('scope');
    const page = Number(searchParams.get('page') ?? '1');

    return {
      filter: {
        // Varsayılan bu kliniğin hastaları; `scope=org` tüm organizasyonu açar.
        clinicId: scope === 'org' ? undefined : clinicId,
        status: (status as PatientStatus | null) ?? undefined,
        search: search ?? undefined,
      },
      pagination: {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: PAGE_SIZE,
      },
    };
  }, [clinicId, searchParams]);

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());

      if (value) next.set(key, value);
      else next.delete(key);

      if (key !== 'page') next.delete('page');

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { ...params, setParam };
}
