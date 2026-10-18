import { z } from 'zod';

/** Kasa oturumu kapatma (fiziki sayım tutarı). Fark entity'de hesaplanır. */
export const CloseCashSessionSchema = z.object({
  // Sayılan tutar kuruş hassasiyetinde: fazla hane yuvarlandığında fark
  // (fazla/açık) gerçekte olmayan bir değere kayar.
  countedAmount: z
    .number()
    .nonnegative()
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    }),
});
