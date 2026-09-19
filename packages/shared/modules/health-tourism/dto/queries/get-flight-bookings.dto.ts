import { createZodDto } from 'nestjs-zod';
import { GetFlightBookingsSchema } from '../../schemas/queries/get-flight-bookings.schema';

export class GetFlightBookingsDto extends createZodDto(
  GetFlightBookingsSchema
) {}
