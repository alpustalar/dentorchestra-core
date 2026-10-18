import { z } from 'zod';

export const PurchaseInvoiceScalarFieldEnumSchema = z.enum(['id','clinicId','organizationId','supplierId','invoiceNumber','invoiceDate','purchaseOrderId','lineAccountCode','vatRate','netTotal','vatTotal','grandTotal','currency','status','cancelledAt','cancelledById','cancelReason','createdAt','updatedAt']);

export default PurchaseInvoiceScalarFieldEnumSchema;
