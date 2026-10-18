import { z } from 'zod';

export const PosTransactionScalarFieldEnumSchema = z.enum(['id','posDeviceId','clinicId','patientId','appointmentId','paymentId','amount','currency','status','externalRef','kind','originalPosTransactionId','activeVoidOriginalId','initiatedById','rawRequest','rawResponse','initiatedAt','completedAt','createdAt','updatedAt']);

export default PosTransactionScalarFieldEnumSchema;
