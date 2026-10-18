import { z } from 'zod';

export const SubscriptionChargeStatusSchema = z.enum(['PENDING','SUCCEEDED','FAILED']);

export type SubscriptionChargeStatusType = `${z.infer<typeof SubscriptionChargeStatusSchema>}`

export default SubscriptionChargeStatusSchema;
