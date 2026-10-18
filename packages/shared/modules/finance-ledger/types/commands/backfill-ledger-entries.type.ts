import { z } from 'zod';
import { BackfillLedgerEntriesSchema } from '../../schemas/commands';

export type BackfillLedgerEntries = z.infer<typeof BackfillLedgerEntriesSchema>;
