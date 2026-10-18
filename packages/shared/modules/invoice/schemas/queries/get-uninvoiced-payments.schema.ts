import { z } from 'zod';

/**
 * Tahsilatı alınmış ama faturası kesilmemiş ödemeler filtresi (mutabakat raporu).
 * Aralık zorunlu — rapor tüm geçmişi taramaz.
 */
export const GetUninvoicedPaymentsSchema = z
  .object({
    clinicId: z.uuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from <= data.to, {
    message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    path: ['from'],
  });
