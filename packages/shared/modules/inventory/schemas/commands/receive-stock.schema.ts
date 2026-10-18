import { z } from 'zod';
import CurrencySchema from '@shared/generated-zod/inputTypeSchemas/CurrencySchema';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

/**
 * Mal kabul. Ondalık sınırları kolonlardan gelir: `product_batches.quantity`
 * `Decimal(10,3)`, `purchase_price` `Decimal(10,2)`. Kapı daha genişken alış
 * fiyatı DB'de sessizce yuvarlanıyor, parti maliyeti (dolayısıyla envanter
 * değeri ve tüketim maliyeti) kaynağından kayıyordu.
 */
export const ReceiveStockSchema = z.object({
  productId: z.uuid(),
  supplierId: z.uuid().optional().nullable(),
  lotNumber: z.string().max(100).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  quantity: z.number().positive().multipleOf(0.001, {
    message: 'Miktar en fazla 3 ondalık basamak taşıyabilir',
  }),
  purchasePrice: z.number().min(0).multipleOf(0.01, {
    message: 'Alış fiyatı en fazla 2 ondalık basamak taşıyabilir',
  }),
  currency: CurrencySchema,
  /**
   * Kabul kümesi kullanım yeriyle aynı sabitten gelir: hareket kaydı oranı
   * `VatRate` VO'suna sokuyor ve yasal olmayan oranı reddediyor — kapı 0–100
   * kaldığı sürece mal kabul, oranın yanında değil kaydın ortasında patlıyordu.
   */
  vatRate: z
    .number()
    .int()
    .refine((rate) => STATUTORY_VAT_RATES.includes(rate), {
      message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
    })
    .optional(),
  notes: z.string().max(1000).optional().nullable(),
});
