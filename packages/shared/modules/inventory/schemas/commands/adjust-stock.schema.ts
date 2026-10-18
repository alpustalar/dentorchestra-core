import { z } from 'zod';

/**
 * Sayım düzeltmesi — stoğu **belgesiz** değiştiren tek uç. Mal kabulün arkasında
 * tedarikçi/sipariş, tüketimin arkasında randevu var; düzeltmenin arkasında
 * yalnız gerekçe olabilir, bu yüzden `notes` zorunludur (CLAUDE.md finans
 * kuralı 7 — yüksek etkili işlem kalıcı damga ister).
 *
 * Ondalık sınırı kolondan gelir (`product_batches.quantity Decimal(10,3)`):
 * daha ince bir delta DB'de yuvarlanır, karar yuvarlanmamış değerden verilir.
 */
export const AdjustStockSchema = z.object({
  productId: z.uuid(),
  batchId: z.uuid().optional().nullable(),
  quantityDelta: z
    .number()
    .multipleOf(0.001, {
      message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
    })
    .refine((v) => v !== 0, { message: 'Delta sıfır olamaz' }),
  /** Düzeltmenin gerekçesi — zorunlu (sayım farkı, zayi, kırılma vb.). */
  notes: z.string().min(5).max(1000),
});
