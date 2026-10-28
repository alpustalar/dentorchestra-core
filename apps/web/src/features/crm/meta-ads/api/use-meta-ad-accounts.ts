'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { metaAdsEndpoints } from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import { metaAdsKeys } from './meta-ads.keys';

export function useMetaAdAccounts(clinicId: string | null) {
  return useQuery({
    queryKey: metaAdsKeys.accounts(clinicId ?? ''),
    queryFn: ({ signal }) =>
      api(metaAdsEndpoints.accounts, {
        params: { clinicId: clinicId ?? '' },
        signal,
      }),
    enabled: Boolean(clinicId),
    retry: false,
  });
}

export function useDisconnectMetaAccount(clinicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      api(metaAdsEndpoints.disconnectAccount, {
        params: { clinicId, accountId },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: metaAdsKeys.accounts(clinicId) }),
  });
}
