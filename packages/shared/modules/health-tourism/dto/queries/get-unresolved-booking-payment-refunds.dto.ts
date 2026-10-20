import { createZodDto } from 'nestjs-zod';
import { GetUnresolvedBookingPaymentRefundsSchema } from '../../schemas/queries';

export class GetUnresolvedBookingPaymentRefundsFilterDto extends createZodDto(
  GetUnresolvedBookingPaymentRefundsSchema
) {}
