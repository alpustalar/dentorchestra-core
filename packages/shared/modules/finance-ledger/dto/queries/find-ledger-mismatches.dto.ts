import { createZodDto } from 'nestjs-zod';
import { FindLedgerMismatchesSchema } from '../../schemas/queries';

export class FindLedgerMismatchesFilterDto extends createZodDto(
  FindLedgerMismatchesSchema
) {}
