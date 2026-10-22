import { PatientStatusType } from '@input-type-schemas/PatientStatusSchema';

// ==========================================
// LİSTELEME / ARAMA FİLTRELERİ
// ==========================================

/**
 * Kişi (telefon/e-posta) ile hasta arama filtresi. `phone` veya `email`'den en az
 * biri sağlanmalıdır — bu kural artık handler'da (find-patient-by-contact) Guard
 * ile uygulanır; eskiden yalnız hiç `.parse()` edilmeyen bir Zod `.refine()` içindeydi.
 */
export interface FindPatientByContactFilter {
  organizationId?: string;
  phone?: string | null;
  email?: string | null;
}

/**
 * Hasta listeleme filtresi. Kapsam organizasyondur (hasta organizasyona ait,
 * klinik opsiyonel); `clinicId` verilirse yalnız o şubenin hastalarına daralır.
 * Ad/telefon/protokol araması `pagination.search` üzerinden yürür — `paginate`
 * helper'ı tek kolonda arar, çok kolonlu arama repo'da açıkça kurulur.
 */
export interface FindPatientsFilter {
  organizationId: string;
  clinicId?: string | null;
  status?: PatientStatusType;
  /** Ad, soyad, telefon veya protokol numarasında geçen metin. */
  search?: string;
}
