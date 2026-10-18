export const PURCHASE_INVOICE_EVENTS = {
  RECORDED: 'purchase-invoice.recorded',
  CANCELLED: 'purchase-invoice.cancelled',
} as const;

export type PurchaseInvoiceEvent =
  (typeof PURCHASE_INVOICE_EVENTS)[keyof typeof PURCHASE_INVOICE_EVENTS];
