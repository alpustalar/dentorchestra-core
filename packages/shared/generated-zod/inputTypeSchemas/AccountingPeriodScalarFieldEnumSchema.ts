import { z } from 'zod';

export const AccountingPeriodScalarFieldEnumSchema = z.enum(['id','clinicId','organizationId','year','status','startsAt','endsAt','lastEntryNo','lockedAt','lockedById','reopenedAt','reopenedById','closedAt','closedById','createdAt','updatedAt']);

export default AccountingPeriodScalarFieldEnumSchema;
