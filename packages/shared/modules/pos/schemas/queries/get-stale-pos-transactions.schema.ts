import { z } from 'zod';

/**
 * Askıda kalmış POS işlemleri filtresi. `olderThanMinutes` varsayılanı 15:
 * mutabakat taraması 5 dakikada bir koştuğu için daha kısa bir pencere henüz
 * işlenmekte olan işlemleri "askıda" gösterir.
 */
export const GetStalePosTransactionsSchema = z.object({
  clinicId: z.uuid({ message: 'Geçersiz klinik ID formatı' }),
  olderThanMinutes: z.coerce
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 30)
    .default(15),
});
