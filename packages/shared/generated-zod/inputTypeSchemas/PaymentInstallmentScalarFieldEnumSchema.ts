import { z } from 'zod';

export const PaymentInstallmentScalarFieldEnumSchema = z.enum(['id','paymentId','installmentNo','amount','currency','method','dueDate','paidAt','note','status','recoversInstallmentId','createdAt','updatedAt']);

export default PaymentInstallmentScalarFieldEnumSchema;
