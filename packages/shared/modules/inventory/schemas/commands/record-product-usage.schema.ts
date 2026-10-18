import { z } from 'zod';

/**
 * Malzeme tüketimi. Miktar sınırı `product_batches.quantity` kolonundan gelir
 * (`Decimal(10,3)`). `appointmentId` verilirse tüketim kaydı o randevuya
 * bağlanır — tedavinin malzeme maliyetinin tek dayanağı budur.
 */
export const RecordProductUsageSchema = z.object({
  productId: z.uuid(),
  batchId: z.uuid().optional().nullable(),
  appointmentId: z.uuid().optional().nullable(),
  quantity: z.number().positive().multipleOf(0.001, {
    message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
  }),
  notes: z.string().max(1000).optional().nullable(),
});
