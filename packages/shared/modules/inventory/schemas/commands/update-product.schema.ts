import { z } from 'zod';
import { ProductUnitSchema } from '../../../../generated-zod/inputTypeSchemas/ProductUnitSchema';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  barcode: z.string().max(50).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  unit: ProductUnitSchema.optional(),
  /**
   * Kabul kümesi oluşturma kapısıyla ve `VatRate` VO'suyla aynı; **0 geçerlidir**
   * (istisna/muafiyet). Entity eskiden güncellemede oranın sıfır olmamasını
   * istiyordu (`hasTax`) — sıfır KDV'li bir ürünün oranı bu yüzden hiç
   * güncellenemiyordu; çelişki §55'te kapatıldı.
   */
  vatRate: z
    .number()
    .int()
    .refine((rate) => STATUTORY_VAT_RATES.includes(rate), {
      message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
    })
    .optional(),
  criticalStockQty: z
    .number()
    .min(0)
    .multipleOf(0.001, {
      message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
    })
    .optional(),
  reorderQty: z
    .number()
    .min(0)
    .multipleOf(0.001, {
      message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
    })
    .optional(),
  categoryId: z.uuid().optional().nullable(),
  supplierId: z.uuid().optional().nullable(),
});
