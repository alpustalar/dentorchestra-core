import { z } from 'zod';

export const SettlementProviderSchema = z.enum(['IYZICO','IYZICO_TERMINAL','PAX_BANK','STRIPE','OTHER']);

export type SettlementProviderType = `${z.infer<typeof SettlementProviderSchema>}`

export default SettlementProviderSchema;
