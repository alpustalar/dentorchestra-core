import { createZodDto } from 'nestjs-zod';
import { GetPayrollAccrualsSchema } from '../../schemas/queries';

export class GetPayrollAccrualsFilterDto extends createZodDto(
  GetPayrollAccrualsSchema
) {}
