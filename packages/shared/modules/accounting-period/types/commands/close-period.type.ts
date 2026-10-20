import { z } from 'zod';
import { ClosePeriodSchema } from '../../schemas/commands';

export type ClosePeriod = z.infer<typeof ClosePeriodSchema>;
