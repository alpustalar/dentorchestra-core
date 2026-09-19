import { createZodDto } from 'nestjs-zod';
import { CancelFlightBookingSchema } from '../../schemas/commands/cancel-flight-booking.schema';

export class CancelFlightBookingDto extends createZodDto(
  CancelFlightBookingSchema
) {}
