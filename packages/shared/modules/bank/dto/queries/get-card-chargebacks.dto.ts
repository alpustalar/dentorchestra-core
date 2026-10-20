import { createZodDto } from 'nestjs-zod';
import { GetCardChargebacksSchema } from '../../schemas/queries';

export class GetCardChargebacksFilterDto extends createZodDto(
  GetCardChargebacksSchema
) {}
