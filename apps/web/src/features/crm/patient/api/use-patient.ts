'use client';

import { useQuery } from '@tanstack/react-query';
import { patientEndpoints } from '@dentorchestra/shared/client';

import { apiWithMeta } from '@/lib/api';

import { patientKeys } from './patient.keys';

/**
 * `apiWithMeta`: hasta detayında `meta.serializationOptions.groups` bilgisi
 * ekranın hangi alanları hiç render etmeyeceğini söyler — backend zaten
 * görmemesi gerekeni cevaptan siliyor, UI "undefined" göstermesin.
 */
export function usePatient(patientId: string | undefined) {
  return useQuery({
    queryKey: patientKeys.detail(patientId ?? ''),
    queryFn: ({ signal }) =>
      apiWithMeta(patientEndpoints.byId, {
        params: { patientId: patientId! },
        signal,
      }),
    enabled: Boolean(patientId),
  });
}
