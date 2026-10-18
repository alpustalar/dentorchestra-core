import { z } from 'zod';
import ProductConditionSchema from '@shared/generated-zod/inputTypeSchemas/ProductConditionSchema';
import ProductUnitSchema from '@shared/generated-zod/inputTypeSchemas/ProductUnitSchema';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

/**
 * Ürün kartı. KDV oranı kullanım yeriyle **aynı** sabitten gelir (`VatRate` VO
 * ürün kartında da yasal kümeyi zorluyor); kritik/yeniden sipariş miktarları
 * kolon ölçeğinde (`Decimal(10,3)`).
 */
export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  stockCode: z.string().min(1).max(50),
  barcode: z.string().max(50).optional().nullable(),
  brand: z.string().max(100).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  unit: ProductUnitSchema,
  condition: ProductConditionSchema.optional(),
  /**
   * **Zorunlu.** Kabul kümesi `VatRate` VO'suyla aynı ve **0 geçerlidir**
   * (istisna/muafiyet). Alan opsiyoneldi ve handler `?? 0` ile dolduruyordu:
   * oranı söylemeyen istek sessizce "istisna kapsamında" sayılıyor, ürünün
   * oranı alış faturasının 191 indirilecek KDV'sini beslediği için indirim
   * kimse seçmemişken eksik kullanılıyordu. Oran bir **beyandır**, varsayılanı
   * olamaz.
   */
  vatRate: z
    .number()
    .int()
    .refine((rate) => STATUTORY_VAT_RATES.includes(rate), {
      message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
    }),
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
  // organizationId ALINMAZ — clinicId'den çözülür (bkz. create-supplier).
  clinicId: z.uuid(),
});
