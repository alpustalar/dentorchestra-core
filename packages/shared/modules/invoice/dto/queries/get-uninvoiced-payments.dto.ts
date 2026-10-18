import { createZodDto } from 'nestjs-zod';
import { GetUninvoicedPaymentsSchema } from '../../schemas/queries';

export class GetUninvoicedPaymentsFilterDto extends createZodDto(
  GetUninvoicedPaymentsSchema
) {}
