import { PurchaseRequest, PurchaseRequestItem, Pagination } from '@shared';

/** Filter for finding purchase requests. */
export interface FindPurchaseRequestsFilter {
  clinicId: string;
  status?: string;
  pagination: Pagination;
}

/**
 * Talep + kalemleri (okuma modeli). `any` idi — kardeşi `PurchaseOrderWithItems`
 * ile aynı sebeple tiplendi: `any` altında alan adının yanlış yazılması derleme
 * hatası vermiyor, `undefined` olarak akıyor.
 */
export type PurchaseRequestWithItems = PurchaseRequest & {
  items: PurchaseRequestItem[];
};

/** Paginated purchase request results. */
export interface PurchaseRequestPage {
  items: PurchaseRequestWithItems[];
  total: number;
  pagination: Pagination;
}
