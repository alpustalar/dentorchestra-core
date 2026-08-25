import { z } from 'zod';

export const DuffelFlightBookingStatusSchema = z.enum(['HELD','CONFIRMED','CANCELLED','FAILED']);

export type DuffelFlightBookingStatusType = `${z.infer<typeof DuffelFlightBookingStatusSchema>}`

export default DuffelFlightBookingStatusSchema;
