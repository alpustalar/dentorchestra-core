import { z } from 'zod';

export const BookingPaymentTypeSchema = z.enum(['HOTEL','TRANSFER','FLIGHT']);

export type BookingPaymentTypeType = `${z.infer<typeof BookingPaymentTypeSchema>}`

export default BookingPaymentTypeSchema;
