import { z } from 'zod';
import { GetUnresolvedBookingPaymentRefundsSchema } from '../../schemas/queries';

export type GetUnresolvedBookingPaymentRefunds = z.infer<
  typeof GetUnresolvedBookingPaymentRefundsSchema
>;
