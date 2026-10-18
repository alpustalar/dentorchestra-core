import { z } from 'zod';

export const JournalEntryKindSchema = z.enum(['OPERATIONAL','CLOSING']);

export type JournalEntryKindType = `${z.infer<typeof JournalEntryKindSchema>}`

export default JournalEntryKindSchema;
