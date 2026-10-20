import { createZodDto } from 'nestjs-zod';
import { ResolveBookingPaymentRefundSchema } from '../../schemas/commands';

export class ResolveBookingPaymentRefundDto extends createZodDto(
  ResolveBookingPaymentRefundSchema
) {}
