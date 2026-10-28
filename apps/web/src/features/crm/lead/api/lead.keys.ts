import type { GetLeads, PaginationInput } from '@dentorchestra/shared/client';

/**
 * Invalidation'ın öngörülebilir olması için anahtarlar hiyerarşik kurulur:
 * `lists(clinicId)` altındaki her filtre/sayfa kombinasyonu tek çağrıyla
 * geçersizleştirilebilir. Command'ler zengin model döndürmediği için
 * (CLAUDE.md: create → `id`, update → `void`) cache'i mutation cevabından
 * besleyemiyoruz; invalidate zorunlu.
 */
export const leadKeys = {
  all: ['leads'] as const,

  lists: (clinicId: string) => [...leadKeys.all, 'list', clinicId] as const,

  list: (
    clinicId: string,
    filter: GetLeads | undefined,
    pagination: PaginationInput | undefined
  ) => [...leadKeys.lists(clinicId), { filter, pagination }] as const,

  details: () => [...leadKeys.all, 'detail'] as const,

  detail: (leadId: string) => [...leadKeys.details(), leadId] as const,
};
