import { z } from 'zod';
import { PostUnpostedFinancialEventsSchema } from '../../schemas/commands';

export type PostUnpostedFinancialEvents = z.infer<
  typeof PostUnpostedFinancialEventsSchema
>;
