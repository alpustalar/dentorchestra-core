import { createZodDto } from 'nestjs-zod';
import { InitiateMetaOAuthSchema } from '../../schemas/commands';

export class InitiateMetaOAuthDto extends createZodDto(
  InitiateMetaOAuthSchema,
) {}
