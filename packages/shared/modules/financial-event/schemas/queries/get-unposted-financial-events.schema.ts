import { z } from 'zod';

/**
 * Fişlenmemiş ekonomik olay listesi (mutabakat): olay defteri ↔ yevmiye farkı.
 * Aralık zorunludur; genelde dönem başı/sonu verilir.
 */
export const GetUnpostedFinancialEventsSchema = z
  .object({
    clinicId: z.uuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  /**
   * Ters aralık sessizce **boş** sonuç verirdi: mutabakat listesi "fişlenmemiş
   * olay yok" (yani defter temiz), backfill ise "0 olay denendi" (yani iş bitti)
   * diye okunur. İkisi de yanlış güvence; aralık kapıda doğrulanır.
   */
  .refine((v) => v.from <= v.to, {
    message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    path: ['from'],
  });
