import { z } from 'zod';

export const GetCardChargebacksSchema = z.object({
  /** Verilmezse aktörün kendi kliniği; verilirse aktörün finans yetkisi doğrulanır. */
  clinicId: z.uuid().optional(),
  status: z.enum(['OPEN', 'WON', 'LOST']).optional(),
});
