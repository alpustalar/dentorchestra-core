import { createZodDto } from 'nestjs-zod';
import { BackfillLedgerEntriesSchema } from '../../schemas/commands';

export class BackfillLedgerEntriesDto extends createZodDto(
  BackfillLedgerEntriesSchema
) {}
