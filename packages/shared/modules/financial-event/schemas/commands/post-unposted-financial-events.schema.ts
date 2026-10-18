import { z } from 'zod';

/**
 * Fişlenmemiş ekonomik olayları (yeniden) fişleme — backfill.
 *
 * Neden manuel bir uç: posting hatası dinleyicide bilerek yutuluyor (olay defteri
 * bozulmasın) ve otomatik yeniden deneme yok. CRITICAL uyarı durumu görünür kılar,
 * bu uç da düzeltme yolunu verir.
 */
export const PostUnpostedFinancialEventsSchema = z
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
