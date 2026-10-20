import { createZodDto } from 'nestjs-zod';
import { GetClinicAppointmentsSchema } from '../../schemas/queries';

export class GetClinicAppointmentsDto extends createZodDto(
  GetClinicAppointmentsSchema
) {}
