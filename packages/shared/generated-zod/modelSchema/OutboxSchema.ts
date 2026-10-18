import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'

/////////////////////////////////////////
// OUTBOX SCHEMA
/////////////////////////////////////////

export const OutboxSchema = z.object({
  id: z.string(),
  type: z.string(),
  payload: JsonValueSchema,
  /**
   * Teslim sırası. `createdAt` **bir transaction içinde sabittir** (Postgres'te
   * CURRENT_TIMESTAMP tx başlangıç anıdır), dolayısıyla aynı `outboxRun()` ile
   * mühürlenen event'leri sıralayamaz: hepsi aynı damgayı taşır. Sıra bir kimlik
   * değil, veritabanının atadığı **teslim numarasıdır** — bu yüzden ID politikasının
   * (elle üretilen id) kapsamı dışındadır ve uygulamadan güvenle atanamaz.
   */
  seq: z.bigint(),
  createdAt: z.coerce.date(),
  processedAt: z.coerce.date().nullable(),
  /**
   * Kaç kez teslim denendi. Sahiplenme anında artar: süreç teslim ortasında
   * çökse bile deneme sayılır, yoksa aynı kayıt sonsuza kadar döngüye girer.
   */
  attempts: z.number().int(),
  /**
   * Son hatanın mesajı — ölü mektup kaydına bakan operatörün tek ipucu.
   */
  lastError: z.string().nullable(),
  /**
   * Ölü mektup: deneme hakkı tükendi. Artık sahiplenilmez; elle müdahale (hatayı
   * giderip `attempts`/`failedAt` sıfırlama) bekler. Sessizce kaybolmaz.
   */
  failedAt: z.coerce.date().nullable(),
  /**
   * Kiralama (lease). Kaydı bir işçi aldı; süresi geçerse başka işçi devralır.
   * Kilitsiz `findMany` ile iki örnek aynı kaydı iki kez yayınlıyordu.
   */
  claimedAt: z.coerce.date().nullable(),
})

export type Outbox = z.infer<typeof OutboxSchema>

export default OutboxSchema;
