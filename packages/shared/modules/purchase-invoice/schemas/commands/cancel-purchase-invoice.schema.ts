import { z } from 'zod';

/**
 * Alış faturası iptali (storno). Gerekçe zorunlu ve anlamlı uzunlukta: iptal 320
 * Satıcılar borcunu ters kayıtla kapatır ve siparişin faturalanmış tutarını
 * düşürür — kalıcı damganın gerekçesidir (CLAUDE.md finans kuralı 7).
 */
export const CancelPurchaseInvoiceSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});
