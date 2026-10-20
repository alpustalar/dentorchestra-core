import { z } from 'zod';

export const BookingPaymentRefundScalarFieldEnumSchema = z.enum(['id','bookingPaymentId','clinicId','organizationId','kind','origin','provider','chargeProviderRef','amount','currency','status','attemptCount','reason','failureReason','requestedAt','requestedById','providerRefundRef','refundedAt','resolution','resolvedById','resolvedAt','resolutionNote','createdAt','updatedAt']);

export default BookingPaymentRefundScalarFieldEnumSchema;
