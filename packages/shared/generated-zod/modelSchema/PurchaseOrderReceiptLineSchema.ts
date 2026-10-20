import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';

/////////////////////////////////////////
// PURCHASE ORDER RECEIPT LINE SCHEMA
/////////////////////////////////////////

/**
 * Kabulün kalem satırı. `unit_price` kabul anındaki birim fiyatın **anlık görüntüsüdür**:
 * GRNI tutarı (miktar × fiyat) günlüğün kendisinden hesaplanır; sipariş kaleminin sonradan
 * değişmesi geçmiş bir yılın tahakkukunu oynatamaz.
 */
export const PurchaseOrderReceiptLineSchema = z.object({
  id: z.string(),
  receiptId: z.string(),
  itemId: z.string(),
  quantity: decimalSchema("Field 'quantity' must be a Decimal. Location: ['Models', 'PurchaseOrderReceiptLine']"),
  unitPrice: decimalSchema("Field 'unitPrice' must be a Decimal. Location: ['Models', 'PurchaseOrderReceiptLine']"),
})

export type PurchaseOrderReceiptLine = z.infer<typeof PurchaseOrderReceiptLineSchema>

export default PurchaseOrderReceiptLineSchema;
