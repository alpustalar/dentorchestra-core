import { z } from 'zod';

export const PurchaseOrderReceiptLineScalarFieldEnumSchema = z.enum(['id','receiptId','itemId','quantity','unitPrice']);

export default PurchaseOrderReceiptLineScalarFieldEnumSchema;
