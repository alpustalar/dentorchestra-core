import { z } from 'zod';
import { UpsertEDocumentIntegrationSchema } from '../../schemas/commands';

export type UpsertEDocumentIntegration = z.infer<
  typeof UpsertEDocumentIntegrationSchema
>;
