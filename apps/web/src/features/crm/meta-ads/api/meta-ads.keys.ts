import type { PaginationInput } from '@dentorchestra/shared/client';

/** `yyyy-mm-dd` sınırlar — finance-ledger-workspace ile aynı tarih aralığı şekli. */
export interface DateRange {
  from: string;
  to: string;
}

/**
 * Hiyerarşik anahtarlar: `leadsList(clinicId)` altındaki her filtre/sayfa
 * kombinasyonu bir eşleştirme mutation'ı sonrası tek çağrıyla geçersiz
 * kılınabilir (bkz. `leadKeys` deseni, `features/crm/lead/api/lead.keys.ts`).
 */
export const metaAdsKeys = {
  all: ['meta-ads'] as const,

  accounts: (clinicId: string) => [...metaAdsKeys.all, 'accounts', clinicId] as const,

  reports: (clinicId: string) => [...metaAdsKeys.all, 'report', clinicId] as const,
  report: (clinicId: string, range: DateRange) =>
    [...metaAdsKeys.reports(clinicId), range] as const,

  roiReports: (clinicId: string) => [...metaAdsKeys.all, 'roi', clinicId] as const,
  roiReport: (clinicId: string, range: DateRange) =>
    [...metaAdsKeys.roiReports(clinicId), range] as const,

  leadsList: (clinicId: string) => [...metaAdsKeys.all, 'leads', clinicId] as const,
  leads: (
    clinicId: string,
    status: string | undefined,
    pagination: PaginationInput | undefined
  ) => [...metaAdsKeys.leadsList(clinicId), { status, pagination }] as const,
};
