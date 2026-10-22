import { z } from 'zod';
import { InitiateMetaOAuthSchema } from '../../schemas/commands';

export type InitiateMetaOAuth = z.infer<typeof InitiateMetaOAuthSchema>;
