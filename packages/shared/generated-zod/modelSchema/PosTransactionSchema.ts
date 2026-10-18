import { z } from 'zod';
import { JsonValueSchema } from '../inputTypeSchemas/JsonValueSchema'
import { decimalSchema } from '../../common/decimal';
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { PosTransactionStatusSchema } from '../inputTypeSchemas/PosTransactionStatusSchema'
import { PosTransactionKindSchema } from '../inputTypeSchemas/PosTransactionKindSchema'

/////////////////////////////////////////
// POS TRANSACTION SCHEMA
/////////////////////////////////////////

export const PosTransactionSchema = z.object({
  currency: CurrencySchema,
  status: PosTransactionStatusSchema,
  kind: PosTransactionKindSchema,
  id: z.string(),
  posDeviceId: z.string(),
  clinicId: z.string(),
  patientId: z.string().nullable(),
  appointmentId: z.string().nullable(),
  paymentId: z.string().nullable(),
  amount: decimalSchema("Field 'amount' must be a Decimal. Location: ['Models', 'PosTransaction']"),
  externalRef: z.string().nullable(),
  /**
   * Ters kaydın (VOID/REFUND) geri aldığı orijinal satış. Satışlarda null.
   * Denetim izidir — kaydın durumu ne olursa olsun korunur.
   */
  originalPosTransactionId: z.string().nullable(),
  /**
   * İptal (VOID) kilidi: yalnız CANLI bir iptal kaydında (PENDING/SUCCESS) dolu olur,
   * iptal FAILED/CANCELLED/TIMEOUT'a düştüğünde null'a çekilir. Postgres'te NULL'lar
   * birbiriyle çakışmadığı için `@unique` burada "bir satışın en fazla BİR canlı iptali
   * olabilir; başarısız denemeden sonra tekrar denenebilir" kuralını partial unique index
   * semantiğiyle uygular — ama raw SQL yerine Prisma'nın gördüğü bir kısıt olarak
   * (aksi halde ileride üretilecek bir migration index'i sessizce düşürebilirdi).
   * İadeler kısmi olabildiği için bu kilidi kullanmaz; kümülatif tutar kontrolü
   * handler'da, orijinal satır FOR UPDATE kilitliyken yapılır.
   */
  activeVoidOriginalId: z.string().nullable(),
  /**
   * İşlemi terminalde başlatan personel (Firebase UID — ham string, UUID değil).
   * SALE'de kartı çeken, VOID/REFUND'da ters kaydı atan kişidir: her ters kayıt
   * kendi satırı olduğu için tek kolon ikisini de damgalar (CLAUDE.md kural 7 —
   * yüksek etkili işlem kalıcı damga ister). Eski satırlar için null; yeni kayıtta
   * `CreatePosTransactionProps.initiatedById` ZORUNLU, çünkü varsayılanı olamaz:
   * "sistem" damgası, kartı fiilen çeken kişinin yerine geçtiği an izi yok eder.
   */
  initiatedById: z.string().nullable(),
  rawRequest: JsonValueSchema.nullable(),
  rawResponse: JsonValueSchema.nullable(),
  initiatedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type PosTransaction = z.infer<typeof PosTransactionSchema>

export default PosTransactionSchema;
