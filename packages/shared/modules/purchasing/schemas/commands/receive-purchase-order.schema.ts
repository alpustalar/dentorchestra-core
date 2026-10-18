import { z } from 'zod';

/**
 * Mal kabul — siparişin kalemlerinden teslim alınan miktarlar.
 *
 * Miktar sınırı `purchase_order_items.quantity_received` kolonundan gelir
 * (`Decimal(12,3)`): daha ince bir değer kabul edilirse kümülatif sayaç DB'de
 * yuvarlanır, "tamamı teslim alındı" kararı ise yuvarlanmamış toplamdan verilir
 * → sipariş hiç kapanmaz ya da olmayan mal teslim alınmış görünür.
 */
export const ReceivePurchaseOrderSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.uuid(),
        quantity: z.number().positive().multipleOf(0.001, {
          message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
        }),
        lotNumber: z.string().nullable().optional(),
        expiresAt: z.coerce.date().nullable().optional(),
      })
    )
    .min(1),
});
