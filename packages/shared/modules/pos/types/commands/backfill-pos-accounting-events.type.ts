import { z } from 'zod';
import { BackfillPosAccountingEventsSchema } from '../../schemas/commands';

export type BackfillPosAccountingEvents = z.infer<
  typeof BackfillPosAccountingEventsSchema
>;
