'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type GetLeads,
  leadEndpoints,
  type PaginationInput,
} from '@core-crm/shared/client';

import { apiWithMeta } from '@/lib/api';

import { leadKeys } from './lead.keys';

interface UseLeadsParams {
  clinicId: string;
  filter?: GetLeads;
  pagination?: PaginationInput;
}

/**
 * `apiWithMeta` kullanılıyor çünkü tabloya yalnız satırlar değil, sunucunun
 * saydığı toplam da lazım — sayfalama sunucu tarafında.
 */
export function useLeads({ clinicId, filter, pagination }: UseLeadsParams) {
  return useQuery({
    queryKey: leadKeys.list(clinicId, filter, pagination),
    queryFn: ({ signal }) =>
      apiWithMeta(leadEndpoints.list, {
        params: { clinicId },
        query: filter,
        pagination,
        signal,
      }),
    // Sayfa/filtre değişiminde tablo boşalıp zıplamasın; eski veri yenisi
    // gelene kadar durur.
    placeholderData: keepPreviousData,
  });
}
