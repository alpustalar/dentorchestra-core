import { z } from 'zod';

export const DuffelFlightBookingScalarFieldEnumSchema = z.enum(['id','organizationId','clinicId','patientId','leadId','duffelOrderId','bookingReference','offerId','mode','status','passengers','slices','totalAmount','currency','holdExpiresAt','paymentClaimedAt','failureReason','createdAt','updatedAt']);

export default DuffelFlightBookingScalarFieldEnumSchema;
