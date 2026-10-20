import { z } from 'zod';
import { PurchaseOrderReceiptSourceSchema } from '../inputTypeSchemas/PurchaseOrderReceiptSourceSchema'

/////////////////////////////////////////
// PURCHASE ORDER RECEIPT SCHEMA
/////////////////////////////////////////

/**
 * Mal kabul **günlüğü** (başlık). `purchase_order_items.quantity_received` kümülatif bir
 * sayaçtır ve tarih taşımaz: "31 Aralık itibarıyla faturası gelmemiş mal" (GRNI) sorusunun
 * cevabı kabulün ZAMANINA bağlıdır ve sonradan geri üretilemez — sayaç bugünkü toplamı verir,
 * 31 Aralık'ı vermez. Bu yüzden her kabul kendi kaydını bırakır.
 * 
 * Kabul komutuyla AYNI transaction'da yazılır (sipariş aggregate'i üretir); sayaç ile günlük
 * toplamı her an eşittir (`pnpm finans:degismezler` kontrol eder). Satır silinmez/güncellenmez.
 * 
 * `received_at` kabulün SİSTEME GİRİLDİĞİ andır, fiziksel teslim günü değildir (stok hareketi de
 * aynı anla damgalanır — ikisi birlikte tutarlıdır). Fiziksel teslim tarihi girişi ayrı bir karar.
 */
export const PurchaseOrderReceiptSchema = z.object({
  source: PurchaseOrderReceiptSourceSchema,
  id: z.string(),
  orderId: z.string(),
  clinicId: z.string(),
  organizationId: z.string(),
  receivedAt: z.coerce.date(),
  /**
   * Personel kimliği (Firebase UID — UUID değil). Backfill'de null.
   */
  receivedById: z.string().nullable(),
  createdAt: z.coerce.date(),
})

export type PurchaseOrderReceipt = z.infer<typeof PurchaseOrderReceiptSchema>

export default PurchaseOrderReceiptSchema;
