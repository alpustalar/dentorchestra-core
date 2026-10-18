import { createZodDto } from 'nestjs-zod';
import { BackfillBookingLedgerEntriesSchema } from '../../schemas/commands';

export class BackfillBookingLedgerEntriesDto extends createZodDto(
  BackfillBookingLedgerEntriesSchema
) {}
