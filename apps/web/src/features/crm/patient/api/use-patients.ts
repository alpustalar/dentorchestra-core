'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  type GetPatients,
  type PaginationInput,
  patientEndpoints,
} from '@dentorchestra/shared/client';

import { apiWithMeta } from '@/lib/api';

import { patientKeys } from './patient.keys';

interface UsePatientsParams {
  filter?: GetPatients;
  pagination?: PaginationInput;
}

export function usePatients({ filter, pagination }: UsePatientsParams) {
  return useQuery({
    queryKey: patientKeys.list(filter, pagination),
    queryFn: ({ signal }) =>
      apiWithMeta(patientEndpoints.list, {
        query: filter,
        pagination,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}
