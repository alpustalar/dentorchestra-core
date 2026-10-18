import { createZodDto } from 'nestjs-zod';
import { CancelPurchaseInvoiceSchema } from '../../schemas/commands';

export class CancelPurchaseInvoiceDto extends createZodDto(
  CancelPurchaseInvoiceSchema
) {}
