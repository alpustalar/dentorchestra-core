import { createZodDto } from 'nestjs-zod';
import { BackfillMissingInvoicesSchema } from '../../schemas/commands';

export class BackfillMissingInvoicesDto extends createZodDto(
  BackfillMissingInvoicesSchema
) {}
