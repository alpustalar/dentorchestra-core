/**
 * Bir siparişe bağlı alış faturasının **tutar** görünümü — başka modüllerin (satın alma GRNI
 * mutabakatı, yıl sonu tahakkuku) ihtiyacı olan minimum okuma modeli. Tam fatura değil.
 */
export interface PurchaseInvoiceOrderAmount {
  invoiceId: string;
  purchaseOrderId: string;
  invoiceDate: Date;
  /** Matrah (KDV hariç), kuruş ölçeğinde ondalık string. */
  netTotal: string;
  currency: string;
  /** Faturanın borçlandığı hesap (stok mu gider mi?). */
  lineAccountCode: string;
}

/** `asOf` itibarıyla siparişlere bağlı faturaların filtresi. */
export interface FindInvoiceAmountsByOrdersFilter {
  clinicId: string;
  orderIds: readonly string[];
  /**
   * Fotoğrafın çekildiği an. Fatura tarihi bu anı aşmamalı ve fatura o ana kadar iptal
   * edilmemiş olmalıdır (iptal sonradan olduysa fatura o anda defterdeydi).
   */
  asOf: Date;
}
