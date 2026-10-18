import { z } from 'zod';
import { GetAccountingPeriodsSchema } from '../../schemas/queries';

export type GetAccountingPeriods = z.infer<typeof GetAccountingPeriodsSchema>;
