import { z } from 'zod';
import {
  isVatTaxParameterKey,
  STATUTORY_VAT_RATES,
  TAX_RATE_MAX_DECIMAL_PLACES,
} from '@shared/common/constants';

export const TaxParameterKeyEnum = z.enum([
  'VAT_HEALTH',
  'VAT_STANDARD',
  'VAT_REDUCED',
  'WHT_SELF_EMPLOYMENT',
  'WHT_RENT',
  'CORP_TAX',
]);

/**
 * Vergi parametresi yazma kapısı.
 *
 * Oran kümesi **kullanım yeriyle aynı** sabitten gelir: KDV anahtarlarında
 * yasal küme (`STATUTORY_VAT_RATES`) zorlanır — kapı 0–100 iken yönetici
 * tabloya %8 yazabiliyordu, değer sorunsuz kaydediliyor, sonra fatura
 * kesilirken `VatRate` onu reddediyordu (CLAUDE.md finans kuralı 12). Aynı
 * kontrol `TaxParameter.assertValidRate` ile domain tarafında da durur; burası
 * hatayı sebebinin yanında gösterir.
 */
export const SetTaxParameterSchema = z
  .object({
    key: TaxParameterKeyEnum,
    rate: z
      .number()
      .min(0)
      .max(100)
      .multipleOf(0.01, {
        message: `Oran en fazla ${TAX_RATE_MAX_DECIMAL_PLACES} ondalık basamak taşıyabilir`,
      }),
    /** Yürürlük başlangıcı; verilmezse şimdi alınır. */
    validFrom: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      !isVatTaxParameterKey(data.key) ||
      STATUTORY_VAT_RATES.includes(data.rate),
    {
      message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
      path: ['rate'],
    }
  );
