import { createZodDto } from 'nestjs-zod';
import { GetTransferBookingsSchema } from '../../schemas/queries/get-transfer-bookings.schema';

export class GetTransferBookingsDto extends createZodDto(
  GetTransferBookingsSchema
) {}
