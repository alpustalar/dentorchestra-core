import { z } from 'zod';

export const CardChargebackStatusSchema = z.enum(['OPEN','WON','LOST']);

export type CardChargebackStatusType = `${z.infer<typeof CardChargebackStatusSchema>}`

export default CardChargebackStatusSchema;
