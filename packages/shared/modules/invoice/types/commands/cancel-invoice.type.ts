import { z } from 'zod';
import { CancelInvoiceSchema } from '../../schemas/commands';

export type CancelInvoice = z.infer<typeof CancelInvoiceSchema>;
