import { z } from 'zod';

export const IyzicoTerminalRefundSchema = z.object({
  originalPosTransactionId: z.uuid(),
  clinicId: z.uuid(),
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
