import { z } from 'zod';

export const EDocumentProviderSchema = z.enum(['NILVERA', 'LOGO', 'PARASUT']);
export const EDocumentEnvironmentSchema = z.enum(['TEST', 'PRODUCTION']);

/**
 * Write-only Nilvera bağlantı sözleşmesi. Yeni sağlayıcı adapter'ı geldiğinde
 * sağlayıcıya özel doğrudan şemalar ayrı tutulup union burada genişletilir.
 */
export const UpsertEDocumentIntegrationSchema = z.object({
  provider: z.literal('NILVERA'),
  environment: EDocumentEnvironmentSchema,
  apiKey: z.string().trim().min(16).max(500),
});
