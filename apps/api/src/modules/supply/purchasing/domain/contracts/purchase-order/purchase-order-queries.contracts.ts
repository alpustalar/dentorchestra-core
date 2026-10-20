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

/**
 * Yıl sonu GRNI tahakkuku için siparişin **günlükten** okunan görünümü: kalemler (ürün bağı) +
 * `asOf`'a kadar yapılmış kabuller. Faturalar başka modülde (QueryBus ile ayrıca okunur).
 */
export interface GrniAccrualOrderRecord {
  id: string;
  supplierId: string;
  orderDate: Date;
  currency: string;
  items: { id: string; productId: string | null }[];
  receipts: {
    source: 'GOODS_RECEIPT' | 'LEGACY_BACKFILL';
    lines: { itemId: string; quantity: string; unitPrice: string }[];
  }[];
}

export interface FindGrniAccrualOrdersFilter {
  clinicId: string;
  /** Yalnız `receivedAt ≤ asOf` kabuller okunur. */
  asOf: Date;
}
