import { z } from 'zod';
import { GetStalePosTransactionsSchema } from '../../schemas/queries';

export type GetStalePosTransactions = z.infer<
  typeof GetStalePosTransactionsSchema
>;
