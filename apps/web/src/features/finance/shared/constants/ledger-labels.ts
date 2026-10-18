/**
 * Backend enum'larının Türkçe karşılıkları. `Record<string, string>` — enum
 * tipleri `generated-zod`'un runtime şemasından gelirdi ve o paket bilerek
 * tarayıcıya sokulmuyor (bkz. `packages/shared/client.ts`).
 *
 * Bilinmeyen bir değerde ham anahtar gösterilir: sunucu yeni bir enum üyesi
 * eklediğinde ekran boş kalmaz, çevrilmemiş ama doğru bir değer görünür.
 */
export const LEDGER_TYPE_LABELS: Record<string, string> = {
  INCOME: 'Gelir',
  EXPENSE: 'Gider',
};

export const LEDGER_STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
  REFUNDED: 'İade',
};

export const LEDGER_CATEGORY_LABELS: Record<string, string> = {
  TREATMENT_PAYMENT: 'Tedavi tahsilatı',
  REFUND: 'İade',
  MATERIAL_PURCHASE: 'Malzeme alımı',
  STOCK_ADJUSTMENT: 'Stok düzeltmesi',
  SALARY: 'Maaş',
  RENT: 'Kira',
  OTHER: 'Diğer',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Bekliyor',
  ISSUED: 'Kesildi',
  FAILED: 'Başarısız',
  CANCELLED: 'İptal',
};
