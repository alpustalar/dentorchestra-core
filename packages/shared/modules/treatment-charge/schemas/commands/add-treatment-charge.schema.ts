import { z } from 'zod';
import { STATUTORY_VAT_RATES } from '@shared/common/constants';

/**
 * Randevuya fiyatlı işlem satırı ekler.
 *
 * `listPrice` GÖNDERİLMEZ — tedavinin o anki liste fiyatından okunup satıra
 * dondurulur. İstemcinin fiyat dikte etmesi indirim denetimini anlamsız kılardı;
 * satırdaki tek serbest ticari alan indirimdir ve o da klinik tavanına tabidir.
 */
export const AddTreatmentChargeSchema = z.object({
  treatmentId: z.uuid(),
  /**
   * Adet kesirli olabilir (seans, ml, gram) ama DB kolonu `Decimal(10,3)`:
   * daha ince bir değer sessizce yuvarlanır ve satır tutarı kaynağından kayar.
   */
  quantity: z.coerce
    .number()
    .positive()
    .multipleOf(0.001, {
      message: 'Adet en fazla 3 ondalık basamak taşıyabilir',
    })
    .default(1),
  description: z.string().max(300).nullable().optional(),

  /** İndirim yüzdesi (0–100). Klinik tavanını aşan değeri yalnız yönetici geçirebilir. */
  discountRate: z.coerce.number().min(0).max(100).default(0),
  discountReason: z.string().max(300).nullable().optional(),

  /**
   * KDV oranı; verilmezse kliniğin geçerli sağlık KDV parametresi kullanılır.
   *
   * Kabul kümesi **kullanım yeriyle aynı** sabitten gelir (`VatRate` VO aynı
   * listeyi zorlar): kapı 0–100 iken istemci %8 gönderebiliyordu, istek kapıdan
   * geçiyor ve satır oluşurken "Yasal olmayan KDV oranı" ile sebebinden kopuk
   * bir yerde patlıyordu (CLAUDE.md finans kuralı 12).
   */
  vatRate: z.coerce
    .number()
    .int()
    .refine((rate) => STATUTORY_VAT_RATES.includes(rate), {
      message: `KDV oranı yasal kümede olmalı: ${STATUTORY_VAT_RATES.join(' / ')}`,
    })
    .optional(),
});
