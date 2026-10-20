import { createZodDto } from 'nestjs-zod';
import { ResolveCardChargebackSchema } from '../../schemas/commands';

export class ResolveCardChargebackDto extends createZodDto(
  ResolveCardChargebackSchema
) {}
