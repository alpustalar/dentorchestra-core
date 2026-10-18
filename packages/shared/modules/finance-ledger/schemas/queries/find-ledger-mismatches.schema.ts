import { z } from 'zod';

/**
 * Cari defter mutabakatı penceresi (kaynak taksit ↔ defter kaydı).
 *
 * Tarih aralığı **zorunlu**: mutabakat her çağrıda bütün geçmişi taramamalı;
 * operatör hangi pencereyi incelediğini açıkça söyler. Aynı şema telafi
 * (backfill) komutunun gövdesi olarak da kullanılır — rapor ile onarımın
 * kapsamı tek bir sabitten gelir, iki kopya liste birbirinden kayar.
 */
export const FindLedgerMismatchesSchema = z
  .object({
    clinicId: z.uuid(),
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.from <= data.to, {
    message: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.',
    path: ['from'],
  });
