import { createZodDto } from 'nestjs-zod';
import { GetOrganizationAppointmentsSchema } from '../../schemas/queries';

export class GetOrganizationAppointmentsDto extends createZodDto(
  GetOrganizationAppointmentsSchema
) {}
