import { z } from 'zod';
import { EDocumentIntegrationScopeSchema } from '../inputTypeSchemas/EDocumentIntegrationScopeSchema'
import { EDocumentProviderSchema } from '../inputTypeSchemas/EDocumentProviderSchema'
import { EDocumentEnvironmentSchema } from '../inputTypeSchemas/EDocumentEnvironmentSchema'

/////////////////////////////////////////
// E DOCUMENT INTEGRATION CONFIG SCHEMA
/////////////////////////////////////////

/**
 * E-belge sağlayıcı kimlikleri. Secret'lar uygulama katmanında AES-256-GCM ile
 * tek bir şifreli blob'a çevrilir; bu tablo düz API key/şifre taşımaz.
 */
export const EDocumentIntegrationConfigSchema = z.object({
  scope: EDocumentIntegrationScopeSchema,
  provider: EDocumentProviderSchema,
  environment: EDocumentEnvironmentSchema,
  id: z.string(),
  credentialsCiphertext: z.string(),
  credentialHint: z.string().nullable(),
  isActive: z.boolean(),
  lastTestedAt: z.coerce.date().nullable(),
  lastTestSucceeded: z.boolean().nullable(),
  clinicId: z.string().nullable(),
  organizationId: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type EDocumentIntegrationConfig = z.infer<typeof EDocumentIntegrationConfigSchema>

export default EDocumentIntegrationConfigSchema;
