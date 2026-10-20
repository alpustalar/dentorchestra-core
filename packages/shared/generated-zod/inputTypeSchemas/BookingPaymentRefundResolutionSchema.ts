import { z } from 'zod';

export const BookingPaymentRefundResolutionSchema = z.enum(['CONFIRMED','NOT_REFUNDED']);

export type BookingPaymentRefundResolutionType = `${z.infer<typeof BookingPaymentRefundResolutionSchema>}`

export default BookingPaymentRefundResolutionSchema;
