export const FinancialEventDedupeKeys = {
  payroll_accrual: (employeeUserId: string, monthKey: string) =>
    `payroll-accrual:${employeeUserId}:${monthKey}`,
  purchase_invoice: (purchaseInvoiceId: string) =>
    `purchase-invoice:${purchaseInvoiceId}`,
  payment_received: (installmentId: string) =>
    `payment-received:${installmentId}`,
  cash_session_closed: (sessionId: string) =>
    `cash-session-closed:${sessionId}`,
  payment_received_pos: (posTransactionId: string) =>
    `payment-received:pos:${posTransactionId}`,
  /**
   * İade/iptal: anahtar **ters kaydın kendi** id'sidir, orijinal satışın değil.
   * Satış anahtarını kullanmak, aynı satışın ikinci (kısmi) iadesini mükerrer
   * sayıp sessizce yazmadan geçirirdi.
   */
  payment_refunded_pos: (reversalPosTransactionId: string) =>
    `payment-refunded:pos:${reversalPosTransactionId}`,
  payment_refunded: (installmentId: string) =>
    `payment-refunded:${installmentId}`,
  sales_invoice: (invoiceId: string) => `sales-invoice:${invoiceId}`,
  /**
   * Sağlayıcı hesap kapaması. Anahtar kaydın kendi id'sidir; payout'un
   * **tekilliği** ayrıca `(clinicId, provider, reference)` unique kısıtıyla
   * korunur (aynı payout iki kez girilirse 108 iki kez kapanırdı).
   */
  provider_settlement: (settlementId: string) =>
    `provider-settlement:${settlementId}`,
  platform_booking_settled: (bookingPaymentId: string) =>
    `platform-booking-settled:${bookingPaymentId}`,
  /**
   * Rezervasyon iadesi. Anahtar ödeme kaydının id'sidir: v1'de iade tam
   * tutarlıdır ve kayıt yalnız bir kez REFUNDED olur. Kısmi iade geldiğinde
   * anahtar iade hareketinin kendi kimliğine geçmek zorundadır (bkz. POS
   * tarafındaki aynı not), yoksa ikinci kısmi iade mükerrer sayılıp sessizce
   * yazılmadan geçerdi.
   */
  platform_booking_refunded: (bookingPaymentId: string) =>
    `platform-booking-refunded:${bookingPaymentId}`,
  // Dekont numarası klinik içinde tekil kabul edilir; farklı kliniklerin aynı
  // referansı kullanması meşru olduğu için anahtar clinicId ile daraltılır.
  supplier_payment: (clinicId: string, reference: string) =>
    `supplier-payment:${clinicId}:${reference}`,
  purchase_bridge_failed: (purchaseInvoiceId: string) =>
    `purchase-bridge-failed:${purchaseInvoiceId}`,
  /**
   * Stok hareketi (tüketim/zayi/sayım) → defter. Anahtar hareket kimliğidir:
   * hareket kaydı idempotent yazıldığı için aynı hareket iki kez köprülenmez.
   */
  stock_movement: (movementId: string) => `stock-movement:${movementId}`,
} as const;

export type FinancialEventDedupeKey =
  (typeof FinancialEventDedupeKeys)[keyof typeof FinancialEventDedupeKeys];
