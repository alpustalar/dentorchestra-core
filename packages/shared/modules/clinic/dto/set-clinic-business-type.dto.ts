import { createZodDto } from 'nestjs-zod';
import { SetClinicBusinessTypeSchema } from '@shared/modules/clinic';

export class SetClinicBusinessTypeDto extends createZodDto(
  SetClinicBusinessTypeSchema
) {}
