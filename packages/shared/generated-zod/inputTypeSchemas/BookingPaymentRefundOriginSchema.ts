import { z } from 'zod';

export const BookingPaymentRefundOriginSchema = z.enum(['LIVE','LEGACY']);

export type BookingPaymentRefundOriginType = `${z.infer<typeof BookingPaymentRefundOriginSchema>}`

export default BookingPaymentRefundOriginSchema;
