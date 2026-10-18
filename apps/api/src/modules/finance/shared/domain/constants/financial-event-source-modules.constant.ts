export const FINANCIAL_EVENT_SOURCE_MODULES = {
  PAYROLL: 'payroll',
  PURCHASE_INVOICE: 'purchase-invoice',
  PAYMENT: 'payment',
  POS: 'pos',
  CASH_REGISTER: 'cash-register',
  INVOICE: 'invoice',
  /** Sağlık turizmi rezervasyon tahsilatı — platform defterine yazar. */
  BOOKING_PAYMENT: 'booking-payment',
  /** Satıcıya ödeme — 320'deki cari borcu kapatır. */
  SUPPLIER_PAYMENT: 'supplier-payment',
  /** Stok hareketi — tüketim/zayi maliyeti (150 ↔ 740.01/689/679). */
  INVENTORY: 'inventory',
  /** Sağlayıcı hesap kapaması — 108'de bekleyen kart tahsilatlarının 102'ye geçişi. */
  BANK: 'bank',
} as const;

export type FinancialEventSourceModule =
  (typeof FINANCIAL_EVENT_SOURCE_MODULES)[keyof typeof FINANCIAL_EVENT_SOURCE_MODULES];
