import { z } from 'zod';
import { GetUninvoicedPaymentsSchema } from '../../schemas/queries';

export type GetUninvoicedPayments = z.infer<typeof GetUninvoicedPaymentsSchema>;
