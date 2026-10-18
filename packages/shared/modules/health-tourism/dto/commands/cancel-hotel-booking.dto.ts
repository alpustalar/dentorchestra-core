import { createZodDto } from 'nestjs-zod';
import { CancelHotelBookingSchema } from '../../schemas/commands';

export class CancelHotelBookingDto extends createZodDto(
  CancelHotelBookingSchema
) {}
