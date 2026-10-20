import { z } from 'zod';
import { ResolveBookingPaymentRefundSchema } from '../../schemas/commands';

export type ResolveBookingPaymentRefund = z.infer<
  typeof ResolveBookingPaymentRefundSchema
>;
