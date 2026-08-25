import { z } from 'zod';

export const DuffelFlightBookingModeSchema = z.enum(['HOLD','INSTANT']);

export type DuffelFlightBookingModeType = `${z.infer<typeof DuffelFlightBookingModeSchema>}`

export default DuffelFlightBookingModeSchema;
