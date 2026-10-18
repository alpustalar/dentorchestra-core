import { z } from 'zod';

/**
 * Faturası kesilmemiş tahsilatları yeniden faturalama (telafi) isteği.
 *
 * Tarih aralığı **zorunlu**: telafi turu her çağrıda bütün geçmişi taramamalı;
 * operatör hangi pencereyi onarmak istediğini açıkça söyler.
 */
export const BackfillMissingInvoicesSchema = z
  .object({
    clinicId: z.uuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from <= data.to, {
    message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    path: ['from'],
  });
