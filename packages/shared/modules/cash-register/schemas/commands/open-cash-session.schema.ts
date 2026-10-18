import { z } from 'zod';

/** Kasa oturumu açma (açılış nakdiyle). Para birimi kasadan türetilir. */
export const OpenCashSessionSchema = z.object({
  cashRegisterId: z.uuid(),
  // Kuruş sınırı: DB kolonu `Decimal(14,2)`. Fazla hane yuvarlanır ve kapanışta
  // gerçek olmayan bir sayım farkı üretir.
  openingFloat: z
    .number()
    .nonnegative()
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    }),
  note: z.string().nullable().optional(),
});
