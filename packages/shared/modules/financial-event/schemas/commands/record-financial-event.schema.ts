import { z } from 'zod';
import FinancialEventTypeSchema from '@shared/generated-zod/inputTypeSchemas/FinancialEventTypeSchema';
import InputJsonValueSchema from '@shared/generated-zod/inputTypeSchemas/InputJsonValueSchema';
import { FirebaseUidSchema } from '@shared/common/schemas';

/**
 * Ekonomik olay kaydı — olay defterinin (append-only) yazma sözleşmesi.
 *
 * **HTTP sınırında kullanılmaz:** genel amaçlı bir `POST /financial-events` ucu
 * yoktur ve olmamalıdır. Defterin kapısı tipli komutlardır
 * (`RecordSupplierPaymentCommand`, fatura/POS/kasa köprüleri); herkesin serbest
 * gövdeyle olay yazabildiği bir uç, tip-başına gövde doğrulamasını
 * (`validateFinancialEventPayload`) ve dedupe anahtarı disiplinini atlatır.
 * Bu şema yalnız komutun `data` tipini üretir.
 */
export const RecordFinancialEventSchema = z.object({
  id: z.uuid().optional(),
  clinicId: z.uuid(), // defter sahibi şube (source-of-truth)
  type: FinancialEventTypeSchema,
  occurredAt: z.date().optional(),

  payload: InputJsonValueSchema,

  sourceModule: z.string().min(1, 'Kaynak modül belirtilmelidir'),
  sourceRefId: z.string().nullable().optional(),
  dedupeKey: z.string().nullable().optional(),
  /**
   * İşlemi yapan personel. **UUID değil** — `User.id` bir Firebase UID'dir ve
   * kolon ham string tutar (bkz. `FirebaseUidSchema`). `z.uuid()` yazıldığında
   * `ctx.actor.userId` damgalayan bütün çağıranlar (kasa kapanışı, satıcı
   * ödemesi, dönem kapanışı) sözleşmeye aykırı değer geçiyor oluyordu.
   */
  performedById: FirebaseUidSchema.nullable().optional(),
});
