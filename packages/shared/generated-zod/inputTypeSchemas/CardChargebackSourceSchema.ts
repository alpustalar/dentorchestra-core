import { z } from 'zod';

export const CardChargebackSourceSchema = z.enum(['POS_TRANSACTION','ONLINE_PAYMENT']);

export type CardChargebackSourceType = `${z.infer<typeof CardChargebackSourceSchema>}`

export default CardChargebackSourceSchema;
