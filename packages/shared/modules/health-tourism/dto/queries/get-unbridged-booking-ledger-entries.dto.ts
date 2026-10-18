import { createZodDto } from 'nestjs-zod';
import { GetUnbridgedBookingLedgerEntriesSchema } from '../../schemas/queries';

export class GetUnbridgedBookingLedgerEntriesFilterDto extends createZodDto(
  GetUnbridgedBookingLedgerEntriesSchema
) {}
