import { z } from 'zod';

export const PaxRefundSchema = z.object({
  originalPosTransactionId: z.string().uuid(),
  clinicId: z.string().uuid(),
  amount: z
    .number()
    .positive()
    // Kuruştan ince tutar hem DB kolonunda (`Decimal(10,2)`) hem cihaza giden
    // minor-unit çevriminde sessizce yuvarlanır: çekilen tutar ile kayda geçen
    // tutar ayrışır.
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    })
    .optional(),
});
