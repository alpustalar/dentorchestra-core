import { createZodDto } from 'nestjs-zod';
import { FindClinicsByOrganizationSchema } from '@shared/modules/clinic';

export class FindClinicsByOrganizationFilterDto extends createZodDto(
  FindClinicsByOrganizationSchema
) {}
