import { z } from 'zod';
import CurrencySchema from '@shared/generated-zod/inputTypeSchemas/CurrencySchema';

export const IyzicoTerminalSaleSchema = z.object({
  posDeviceId: z.uuid(),
  clinicId: z.uuid(),
  patientId: z.uuid().optional(),
  appointmentId: z.uuid().optional(),
  paymentId: z.uuid().optional(),
  amount: z
    .number()
    .positive()
    // Kuruştan ince tutar hem DB kolonunda (`Decimal(10,2)`) hem cihaza giden
    // minor-unit çevriminde sessizce yuvarlanır: çekilen tutar ile kayda geçen
    // tutar ayrışır.
    .multipleOf(0.01, {
      message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
    }),
  currency: CurrencySchema,
  // 0 = tek çekim, >0 = taksit
  installment: z.number().int().nonnegative().optional(),
});
