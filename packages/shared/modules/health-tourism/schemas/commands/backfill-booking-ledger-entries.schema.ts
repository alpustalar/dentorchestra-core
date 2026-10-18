import { z } from 'zod';

/**
 * Köprüsü kurulmamış rezervasyon hareketlerinin telafisi (CLAUDE.md finans
 * kuralı 4: yutulan kritik iş için alarmın yanında **telafi yolu** şart).
 *
 * Pencere zorunludur — "hepsini dene" demek, operatörün hangi dönemi
 * onayladığını belirsiz bırakır.
 */
export const BackfillBookingLedgerEntriesSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  clinicId: z.uuid().optional(),
});
