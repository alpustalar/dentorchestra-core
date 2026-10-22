import { z } from 'zod';

export const EDocumentProviderSchema = z.enum(['NILVERA','LOGO','PARASUT']);

export type EDocumentProviderType = `${z.infer<typeof EDocumentProviderSchema>}`

export default EDocumentProviderSchema;
