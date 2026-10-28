'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { GetLeads, PaginationInput } from '@dentorchestra/shared/client';

import type { LeadSource, LeadStatus } from '../lead.types';

const PAGE_SIZE = 20;

export interface LeadListParams {
  filter: GetLeads;
  pagination: PaginationInput;
}

/**
 * Filtre ve sayfa **URL'de** taşınır, bileşen state'inde değil. Aynı gerekçe
 * aktif kliniğin route param'da tutulmasıyla aynı (§10): derin bağlantı, geri
 * tuşu, sekme paylaşımı ve yenilemede durumun korunması bedavaya gelir.
 */
export function useLeadListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const params = useMemo<LeadListParams>(() => {
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const search = searchParams.get('search');
    const page = Number(searchParams.get('page') ?? '1');

    return {
      filter: {
        status: (status as LeadStatus | null) ?? undefined,
        source: (source as LeadSource | null) ?? undefined,
        assignedToId: undefined,
      },
      pagination: {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        limit: PAGE_SIZE,
        search: search ?? undefined,
        searchColumn: search ? 'name' : undefined,
      },
    };
  }, [searchParams]);

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());

      if (value) next.set(key, value);
      else next.delete(key);

      // Filtre değişince sayfa başa döner; yoksa 7. sayfada boş sonuç görünür.
      if (key !== 'page') next.delete('page');

      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return { ...params, setParam };
}
