import { z } from 'zod';

export const ChargebackFundsChannelSchema = z.enum(['FUNDS_IN_TRANSIT','BANK']);

export type ChargebackFundsChannelType = `${z.infer<typeof ChargebackFundsChannelSchema>}`

export default ChargebackFundsChannelSchema;
