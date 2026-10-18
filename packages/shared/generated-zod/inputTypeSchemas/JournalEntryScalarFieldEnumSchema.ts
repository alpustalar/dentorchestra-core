import { z } from 'zod';

export const JournalEntryScalarFieldEnumSchema = z.enum(['id','clinicId','organizationId','periodId','eventId','reversedById','performedById','entryNo','entryDate','description','status','kind','createdAt','updatedAt']);

export default JournalEntryScalarFieldEnumSchema;
