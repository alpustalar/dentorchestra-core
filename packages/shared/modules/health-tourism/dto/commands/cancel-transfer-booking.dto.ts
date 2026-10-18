import { createZodDto } from 'nestjs-zod';
import { CancelTransferBookingSchema } from '../../schemas/commands/cancel-transfer-booking.schema';

export class CancelTransferBookingDto extends createZodDto(
  CancelTransferBookingSchema
) {}
