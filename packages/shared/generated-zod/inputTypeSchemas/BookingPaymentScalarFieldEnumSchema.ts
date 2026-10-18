import { z } from 'zod';

export const BookingPaymentScalarFieldEnumSchema = z.enum(['id','bookingType','status','saleCurrency','saleAmount','tryAmount','netAmount','fxRate','supplierAmount','supplierCurrency','intent','iyzicoConversationId','iyzicoToken','iyzicoUrl','stripeSessionId','stripeUrl','paidProvider','paidProviderRef','paidAt','supplierRetainedAmount','supplierRetainedCurrency','refundedAt','refundReason','bookingReference','bookingId','failureReason','clinicId','organizationId','patientId','leadId','conversationId','createdAt','updatedAt']);

export default BookingPaymentScalarFieldEnumSchema;
