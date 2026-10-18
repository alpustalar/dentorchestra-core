import { z } from 'zod';

export const OutboxScalarFieldEnumSchema = z.enum(['id','type','payload','seq','createdAt','processedAt','attempts','lastError','failedAt','claimedAt']);

export default OutboxScalarFieldEnumSchema;
