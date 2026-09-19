import { z } from 'zod';

export const DuffelFlightBookingStatusSchema = z.enum(['HELD','PAYMENT_IN_PROGRESS','CONFIRMED','CANCELLED','FAILED']);

export type DuffelFlightBookingStatusType = `${z.infer<typeof DuffelFlightBookingStatusSchema>}`

export default DuffelFlightBookingStatusSchema;
