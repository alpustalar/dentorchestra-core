import { z } from 'zod';

export const PurchaseOrderReceiptSourceSchema = z.enum(['GOODS_RECEIPT','LEGACY_BACKFILL']);

export type PurchaseOrderReceiptSourceType = `${z.infer<typeof PurchaseOrderReceiptSourceSchema>}`

export default PurchaseOrderReceiptSourceSchema;
