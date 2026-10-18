import { z } from 'zod';
import { GetUnbridgedBookingLedgerEntriesSchema } from '../../schemas/queries';

export type GetUnbridgedBookingLedgerEntries = z.infer<
  typeof GetUnbridgedBookingLedgerEntriesSchema
>;
