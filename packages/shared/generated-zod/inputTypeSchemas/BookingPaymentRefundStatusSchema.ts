import { z } from 'zod';

export const BookingPaymentRefundStatusSchema = z.enum(['PENDING','CONFIRMED','FAILED','UNCONFIRMED']);

export type BookingPaymentRefundStatusType = `${z.infer<typeof BookingPaymentRefundStatusSchema>}`

export default BookingPaymentRefundStatusSchema;
