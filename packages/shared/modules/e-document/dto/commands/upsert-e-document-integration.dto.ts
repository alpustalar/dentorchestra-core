import { createZodDto } from 'nestjs-zod';
import { UpsertEDocumentIntegrationSchema } from '../../schemas/commands';

export class UpsertEDocumentIntegrationDto extends createZodDto(
  UpsertEDocumentIntegrationSchema
) {}
