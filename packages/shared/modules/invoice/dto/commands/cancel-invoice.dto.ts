import { createZodDto } from 'nestjs-zod';
import { CancelInvoiceSchema } from '../../schemas/commands';

export class CancelInvoiceDto extends createZodDto(CancelInvoiceSchema) {}
