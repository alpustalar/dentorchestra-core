import { Decimal } from 'decimal.js';
import { PurchaseOrderReceiptSourceType as PurchaseOrderReceiptSource } from '@input-type-schemas/PurchaseOrderReceiptSourceSchema';

/**
 * `PurchaseOrder.receive()` bağlamı: mal kabul günlüğüne yazılan "kim".
 *
 * Zorunlu parametre: günlük, bir yıl sonu tahakkukunun dayanağıdır ve kabulü kimin
 * girdiği sonradan geri kazanılamaz. Sistem akışları (kimliksiz) açıkça `null` verir.
 */
export interface ReceiveOrderContext {
  /** Personel kimliği (Firebase UID — UUID değil). */
  receivedById: string | null;
}

/** Günlüğün kalem satırı. `unitPrice` kabul anındaki sipariş birim fiyatının anlık görüntüsü. */
export interface PurchaseOrderReceiptLineRecord {
  id: string;
  itemId: string;
  quantity: Decimal;
  unitPrice: Decimal;
}

/**
 * Bir mal kabul çağrısının günlük kaydı — sipariş aggregate'inin ürettiği, henüz
 * kalıcılaşmamış çocuk kayıt. Repository `update(order)` içinde siparişle aynı
 * yazmada saklar; ayrı bir repository ya da ayrı bir transaction yoktur.
 */
export interface PurchaseOrderReceiptRecord {
  id: string;
  orderId: string;
  clinicId: string;
  organizationId: string;
  receivedAt: Date;
  receivedById: string | null;
  source: PurchaseOrderReceiptSource;
  lines: PurchaseOrderReceiptLineRecord[];
}
