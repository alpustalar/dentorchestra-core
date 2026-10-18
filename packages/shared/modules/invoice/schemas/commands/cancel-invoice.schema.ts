import { z } from 'zod';

/**
 * Satış faturası iptali (storno).
 *
 * `reason` **zorunlu ve anlamlı uzunlukta**: iptal defterde ters kayıt üretir ve
 * belgeyi hükümsüz kılar — yüksek etkili bir finansal işlemin kalıcı damgası
 * gerekçesidir (CLAUDE.md finans kuralı 7). Boş/tek kelimelik gerekçe, denetimde
 * "neden iptal edildi" sorusunu yanıtlamaz.
 */
export const CancelInvoiceSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});
