import { z } from 'zod';

export const CardChargebackPlanSyncSchema = z.enum(['SYNCED','NOT_LINKED','NO_MATCHING_INSTALLMENT']);

export type CardChargebackPlanSyncType = `${z.infer<typeof CardChargebackPlanSyncSchema>}`

export default CardChargebackPlanSyncSchema;
