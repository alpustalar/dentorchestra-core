import { z } from 'zod';

/** Kliniğin muhasebe dönemleri listesi. */
export const GetAccountingPeriodsSchema = z.object({
  clinicId: z.uuid(),
});
