import { PurchaseOrder, PurchaseOrderItem, Pagination } from '@shared';

/** Filter for finding purchase orders. */
export interface FindPurchaseOrdersFilter {
  clinicId: string;
  supplierId?: string;
  status?: string;
  billingStatus?: string;
  pagination: Pagination;
}

/**
 * Sipariş + kalemleri (okuma modeli). `any` idi: üçlü eşleştirme hesabı
 * (sipariş ↔ teslim ↔ fatura) bu tipin para alanlarından besleniyor ve `any`
 * altında `quantityReceived`/`unitPrice` adının yanlış yazılması derleme hatası
 * vermiyordu — sessizce `undefined` ile çarpım yapılırdı.
 */
export type PurchaseOrderWithItems = PurchaseOrder & {
  items: PurchaseOrderItem[];
};

/** Paginated purchase order results. */
export interface PurchaseOrderPage {
  items: PurchaseOrderWithItems[];
  total: number;
  pagination: Pagination;
}
