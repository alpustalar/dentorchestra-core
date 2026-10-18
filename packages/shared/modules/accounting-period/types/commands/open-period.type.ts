import { z } from 'zod';
import { OpenPeriodSchema } from '../../schemas/commands';

export type OpenPeriod = z.infer<typeof OpenPeriodSchema>;
