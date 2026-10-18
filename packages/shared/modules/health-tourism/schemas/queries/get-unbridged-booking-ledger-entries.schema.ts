import { z } from 'zod';

/**
 * Platform defterine **köprüsü kurulmamış** rezervasyon hareketleri raporu.
 *
 * Pencere zorunludur: rapor bir mutabakat aracıdır ve dönem bazında çalışır;
 * sınırsız tarama hem büyüyen tabloda tehlikeli hem de "neyin mutabakatı"
 * sorusunu cevapsız bırakır. Pencere `paidAt` **veya** `refundedAt`'e uygular —
 * iki yön iki ayrı tarihte yaşar (iade aylar sonra gelebilir).
 *
 * `clinicId` daraltmadır, yetki kaynağı değildir: defter **platforma** aittir,
 * yetki platform kiracısı üzerinden değerlendirilir.
 */
export const GetUnbridgedBookingLedgerEntriesSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clinicId: z.uuid().optional(),
});
