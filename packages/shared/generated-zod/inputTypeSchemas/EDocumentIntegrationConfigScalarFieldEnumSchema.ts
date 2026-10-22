import { z } from 'zod';

export const EDocumentIntegrationConfigScalarFieldEnumSchema = z.enum(['id','scope','provider','environment','credentialsCiphertext','credentialHint','isActive','lastTestedAt','lastTestSucceeded','clinicId','organizationId','createdAt','updatedAt']);

export default EDocumentIntegrationConfigScalarFieldEnumSchema;
