import { z } from 'zod';

export const BookingPaymentRefundKindSchema = z.enum(['CANCELLATION','BOOKING_FAILED','UNCLAIMED_CHARGE']);

export type BookingPaymentRefundKindType = `${z.infer<typeof BookingPaymentRefundKindSchema>}`

export default BookingPaymentRefundKindSchema;
