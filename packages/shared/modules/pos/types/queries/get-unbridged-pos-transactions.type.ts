import { z } from 'zod';
import { GetUnbridgedPosTransactionsSchema } from '../../schemas/queries';

export type GetUnbridgedPosTransactions = z.infer<
  typeof GetUnbridgedPosTransactionsSchema
>;
