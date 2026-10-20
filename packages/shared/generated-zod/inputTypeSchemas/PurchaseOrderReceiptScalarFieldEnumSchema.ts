import { z } from 'zod';

export const PurchaseOrderReceiptScalarFieldEnumSchema = z.enum(['id','orderId','clinicId','organizationId','receivedAt','receivedById','source','createdAt']);

export default PurchaseOrderReceiptScalarFieldEnumSchema;
