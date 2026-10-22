import { z } from 'zod';

export const EDocumentEnvironmentSchema = z.enum(['TEST','PRODUCTION']);

export type EDocumentEnvironmentType = `${z.infer<typeof EDocumentEnvironmentSchema>}`

export default EDocumentEnvironmentSchema;
