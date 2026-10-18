import { createZodDto } from 'nestjs-zod';
import { BackfillPosAccountingEventsSchema } from '../../schemas/commands';

export class BackfillPosAccountingEventsDto extends createZodDto(
  BackfillPosAccountingEventsSchema
) {}
