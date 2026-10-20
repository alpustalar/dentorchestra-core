import { z } from 'zod';

/**
 * Kapanmamış rezervasyon iadeleri: sonucu doğrulanmamış (UNCONFIRMED), reddedilmiş ama
 * kapatılmamış (FAILED) ve takılmış PENDING. Operatörün "sağlayıcı panelinde doğrula" listesi.
 *
 * `clinicId` daraltmadır, yetki kaynağı değildir: iade defteri **platforma** aittir, yetki
 * platform kiracısı üzerinden değerlendirilir. Taze PENDING listelenmez (çağrı sürüyor olabilir).
 */
export const GetUnresolvedBookingPaymentRefundsSchema = z.object({
  clinicId: z.uuid().optional(),
  status: z.enum(['UNCONFIRMED', 'FAILED', 'PENDING']).optional(),
});
