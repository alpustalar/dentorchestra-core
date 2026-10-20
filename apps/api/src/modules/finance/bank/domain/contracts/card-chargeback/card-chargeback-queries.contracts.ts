import { Pagination } from '@shared/common';
import type { CardChargebackSourceType } from '@input-type-schemas/CardChargebackSourceSchema';
import type { CardChargebackStatusType } from '@input-type-schemas/CardChargebackStatusSchema';

// ==========================================
// Read-model filtreleri
// ==========================================

export interface FindCardChargebacksFilter {
  clinicId: string;
  status?: CardChargebackStatusType;
  pagination: Pagination;
}

/**
 * Bir kaynağın (POS satışı / sanal POS taksidi) **aktif** itirazlarının toplamını
 * soran kontrat. Aktif = `OPEN` + `LOST`: açık itirazda para sağlayıcıdadır,
 * kaybedilmişte kart sahibine gitmiştir; ikisi de o tutarı artık geri
 * götürülebilir sayılmaz. `WON` düşülmez — para geri geldi.
 */
export interface SumActiveChargebacksParams {
  sourceType: CardChargebackSourceType;
  sourceId: string;
}
