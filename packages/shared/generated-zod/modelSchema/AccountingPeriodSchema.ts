import { z } from 'zod';
import { AccountingPeriodStatusSchema } from '../inputTypeSchemas/AccountingPeriodStatusSchema'

/////////////////////////////////////////
// ACCOUNTING PERIOD SCHEMA
/////////////////////////////////////////

export const AccountingPeriodSchema = z.object({
  status: AccountingPeriodStatusSchema,
  id: z.string(),
  clinicId: z.string(),
  organizationId: z.string(),
  year: z.number().int(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  lastEntryNo: z.bigint(),
  lockedAt: z.coerce.date().nullable(),
  lockedById: z.string().nullable(),
  reopenedAt: z.coerce.date().nullable(),
  reopenedById: z.string().nullable(),
  closedAt: z.coerce.date().nullable(),
  closedById: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type AccountingPeriod = z.infer<typeof AccountingPeriodSchema>

export default AccountingPeriodSchema;
