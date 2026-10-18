import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { PurchaseInvoiceStatusSchema } from '../inputTypeSchemas/PurchaseInvoiceStatusSchema'

/////////////////////////////////////////
// PURCHASE INVOICE SCHEMA
/////////////////////////////////////////

export const PurchaseInvoiceSchema = z.object({
  currency: CurrencySchema,
  status: PurchaseInvoiceStatusSchema,
  id: z.string(),
  clinicId: z.string(),
  organizationId: z.string(),
  supplierId: z.string(),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.coerce.date(),
  /**
   * Eşleştirildiği satın alma siparişi (`supply/purchasing`). Bounded-context:
   * scalar id, navigation YOK. Null = serbest fatura (siparişe bağlı değil).
   */
  purchaseOrderId: z.string().nullable(),
  lineAccountCode: z.string(),
  vatRate: z.number().int(),
  netTotal: decimalSchema("Field 'netTotal' must be a Decimal. Location: ['Models', 'PurchaseInvoice']"),
  vatTotal: decimalSchema("Field 'vatTotal' must be a Decimal. Location: ['Models', 'PurchaseInvoice']"),
  grandTotal: decimalSchema("Field 'grandTotal' must be a Decimal. Location: ['Models', 'PurchaseInvoice']"),
  /**
   * İptal damgası (CLAUDE.md finans kuralı 7). `status = CANCELLED` kimin, ne zaman
   * ve neden iptal ettiğini taşımıyordu; iptal storno fişi ürettiği için iz kalıcı
   * olmak zorunda. `cancelledById` personel kimliğidir (Firebase UID — UUID değil).
   */
  cancelledAt: z.coerce.date().nullable(),
  cancelledById: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PurchaseInvoice = z.infer<typeof PurchaseInvoiceSchema>

export default PurchaseInvoiceSchema;
