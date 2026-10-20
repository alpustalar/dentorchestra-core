import { z } from 'zod';

export const JournalEntryKindSchema = z.enum(['OPERATIONAL','CLOSING','ADJUSTING']);

export type JournalEntryKindType = `${z.infer<typeof JournalEntryKindSchema>}`

export default JournalEntryKindSchema;
