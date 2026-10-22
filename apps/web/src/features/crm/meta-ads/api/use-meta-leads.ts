'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  metaAdsEndpoints,
  type MetaLeadResponse,
  type PaginationInput,
} from '@core-crm/shared/client';

import { api, apiWithMeta } from '@/lib/api';

import { metaAdsKeys } from './meta-ads.keys';

export type MetaLeadStatus = MetaLeadResponse['status'];

interface UseMetaLeadsParams {
  clinicId: string | null;
  status?: MetaLeadStatus;
  pagination?: PaginationInput;
}

export function useMetaLeads({ clinicId, status, pagination }: UseMetaLeadsParams) {
  return useQuery({
    queryKey: metaAdsKeys.leads(clinicId ?? '', status, pagination),
    queryFn: ({ signal }) =>
      apiWithMeta(metaAdsEndpoints.leads, {
        params: { clinicId: clinicId ?? '' },
        query: { clinicId: clinicId ?? '', status },
        pagination,
        signal,
      }),
    enabled: Boolean(clinicId),
    placeholderData: keepPreviousData,
  });
}

/**
 * Gövde (`{ patientId }`) üretilen Orval istemcisinde kaybediyordu
 * (`@Body('patientId')` DTO'suz okunuyordu) — `matchLead` artık
 * `MatchLeadToPatientDto` ile şemadan doğru gönderiyor (bkz. plan notu).
 */
export function useMatchLeadToPatient(clinicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, patientId }: { leadId: string; patientId: string }) =>
      api(metaAdsEndpoints.matchLead, {
        params: { leadId },
        body: { patientId },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: metaAdsKeys.leadsList(clinicId) }),
  });
}
