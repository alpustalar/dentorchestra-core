import { z } from 'zod';
import { BackfillMissingInvoicesSchema } from '../../schemas/commands';

export type BackfillMissingInvoices = z.infer<
  typeof BackfillMissingInvoicesSchema
>;
