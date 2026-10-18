import { z } from 'zod';

/**
 * Köprüsü kurulamamış POS tahsilatlarının telafi turu. Aralık zorunlu: tur
 * idempotent olsa da (dedupeKey) sınırsız tarama operasyonel olarak risklidir.
 */
export const BackfillPosAccountingEventsSchema = z.object({
  clinicId: z.uuid({ message: 'Geçersiz klinik ID formatı' }),
  from: z.coerce.date(),
  to: z.coerce.date(),
});
