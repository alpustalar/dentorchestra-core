import { z } from 'zod';
import { BackfillBookingLedgerEntriesSchema } from '../../schemas/commands';

export type BackfillBookingLedgerEntries = z.infer<
  typeof BackfillBookingLedgerEntriesSchema
>;
