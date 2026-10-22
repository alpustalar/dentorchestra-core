import { z } from 'zod';

export const EDocumentIntegrationScopeSchema = z.enum(['CLINIC','ORGANIZATION']);

export type EDocumentIntegrationScopeType = `${z.infer<typeof EDocumentIntegrationScopeSchema>}`

export default EDocumentIntegrationScopeSchema;
