import type { GetPatients, PaginationInput } from '@dentorchestra/shared/client';

/**
 * Hastalar organizasyon kapsamlı (klinik opsiyonel), bu yüzden anahtarın kökünde
 * clinicId yok — klinik yalnızca bir filtre. Filtre + sayfa anahtarın parçası
 * olduğu için `lists()` tek çağrıda hepsini geçersizleştirir.
 */
export const patientKeys = {
  all: ['patients'] as const,

  lists: () => [...patientKeys.all, 'list'] as const,

  list: (
    filter: GetPatients | undefined,
    pagination: PaginationInput | undefined
  ) => [...patientKeys.lists(), { filter, pagination }] as const,

  details: () => [...patientKeys.all, 'detail'] as const,

  detail: (patientId: string) => [...patientKeys.details(), patientId] as const,
};
