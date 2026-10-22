import { createZodDto } from 'nestjs-zod';
import { MatchLeadToPatientSchema } from '../../schemas/commands';

export class MatchLeadToPatientDto extends createZodDto(
  MatchLeadToPatientSchema,
) {}
