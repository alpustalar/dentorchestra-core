import { z } from 'zod';

export const TreatmentChargeScalarFieldEnumSchema = z.enum(['id','organizationId','clinicId','appointmentId','patientId','treatmentId','description','quantity','listPrice','discountRate','discountAmount','discountReason','netAmount','vatRate','vatAmount','grossAmount','currency','discountApprovedById','createdById','createdAt','updatedAt','voidedAt','voidReason','voidedById']);

export default TreatmentChargeScalarFieldEnumSchema;
