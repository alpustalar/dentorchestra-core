import { z } from 'zod';
import { GetUnpostedFinancialEventsSchema } from '../../schemas/queries';

export type GetUnpostedFinancialEvents = z.infer<
  typeof GetUnpostedFinancialEventsSchema
>;
