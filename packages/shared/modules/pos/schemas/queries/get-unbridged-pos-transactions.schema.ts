import { z } from 'zod';

/** Muhasebe köprüsü kurulmamış POS tahsilatları — tarih aralığı zorunlu. */
export const GetUnbridgedPosTransactionsSchema = z.object({
  clinicId: z.uuid({ message: 'Geçersiz klinik ID formatı' }),
  from: z.coerce.date(),
  to: z.coerce.date(),
});
