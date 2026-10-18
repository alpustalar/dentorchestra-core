import { z } from 'zod';

export const InvoiceScalarFieldEnumSchema = z.enum(['id','organizationId','clinicId','patientId','appointmentId','paymentId','amount','currency','vatRate','netTotal','vatTotal','status','invoiceNumber','issuedAt','documentType','einvoiceUuid','einvoiceStatus','providerRef','rawResponse','cancelledAt','cancelledById','cancelReason','createdAt','updatedAt','isDeleted']);

export default InvoiceScalarFieldEnumSchema;
