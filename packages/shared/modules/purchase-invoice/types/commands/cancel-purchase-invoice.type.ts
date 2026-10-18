import { z } from 'zod';
import { CancelPurchaseInvoiceSchema } from '../../schemas/commands';

export type CancelPurchaseInvoice = z.infer<typeof CancelPurchaseInvoiceSchema>;
