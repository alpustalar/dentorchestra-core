import { createZodDto } from 'nestjs-zod';
import { OpenCardChargebackSchema } from '../../schemas/commands';

export class OpenCardChargebackDto extends createZodDto(
  OpenCardChargebackSchema
) {}
