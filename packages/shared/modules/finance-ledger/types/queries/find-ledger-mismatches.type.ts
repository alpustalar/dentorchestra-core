import { z } from 'zod';
import { FindLedgerMismatchesSchema } from '../../schemas/queries';

export type FindLedgerMismatches = z.infer<typeof FindLedgerMismatchesSchema>;
