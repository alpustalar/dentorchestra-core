import { GetProviderCalendarSchema } from '../../schemas/queries';
import { z } from 'zod';

export type GetProviderCalendar = z.infer<typeof GetProviderCalendarSchema>;
