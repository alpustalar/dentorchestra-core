import { z } from 'zod';

export const SubscriptionChargeScalarFieldEnumSchema = z.enum(['id','subscriptionId','organizationId','periodStart','periodEnd','amount','currency','paidAmount','status','providerPaymentId','conversationId','failureReason','attempts','chargedAt','createdAt','updatedAt']);

export default SubscriptionChargeScalarFieldEnumSchema;
