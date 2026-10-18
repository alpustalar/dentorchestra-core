import { createZodDto } from 'nestjs-zod';
import { GetUnpostedFinancialEventsSchema } from '../../schemas/queries';

export class GetUnpostedFinancialEventsFilterDto extends createZodDto(
  GetUnpostedFinancialEventsSchema
) {}
