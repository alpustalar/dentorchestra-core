import { z } from 'zod';

/**
 * Sağlayıcının reddettiği (ya da operatörün "gerçekleşmedi" dediği) iadenin yeniden denenmesi.
 * Gövde yoktur: hangi iadenin yeniden deneneceği yol parametresidir. Şema, uç sözleşmesinin
 * boş olduğunu açıkça kaydeder.
 */
export const RetryBookingPaymentRefundSchema = z.object({});
