import { createZodDto } from 'nestjs-zod';
import { GetAccountingPeriodsSchema } from '../../schemas/queries';

export class GetAccountingPeriodsFilterDto extends createZodDto(
  GetAccountingPeriodsSchema
) {}
