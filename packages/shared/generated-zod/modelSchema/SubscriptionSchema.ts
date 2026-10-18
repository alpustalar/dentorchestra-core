import { z } from 'zod';
import { BillingTargetSchema } from '../inputTypeSchemas/BillingTargetSchema'
import { SubStatusSchema } from '../inputTypeSchemas/SubStatusSchema'

/////////////////////////////////////////
// SUBSCRIPTION SCHEMA
/////////////////////////////////////////

export const SubscriptionSchema = z.object({
  billingTarget: BillingTargetSchema,
  status: SubStatusSchema,
  id: z.string(),
  organizationId: z.string(),
  clinicId: z.string().nullable(),
  /**
   * Sağlayıcı **korelasyon anahtarı** (iyzico `conversationId`): ödeme callback'i
   * aboneliği YALNIZ bunun üzerinden bulur (`findByExternalIdForUpdate`). Bu yüzden
   * ödeme kimliğiyle EZİLMEZ — eskiden `confirmPayment`/`renew` buraya
   * `iyzicoPaymentId` yazıyordu ve ilk bildirimden sonra anahtar kaybolduğu için
   * sağlayıcının ikinci bildirimi (iyzico callback + webhook ikilisi) aboneliği
   * bulamayıp 404 alıyordu; o bildirimde gelen `savedCard` da kayboluyordu.
   */
  externalId: z.string().nullable(),
  /**
   * Son BAŞARILI tahsilatın sağlayıcı kimliği — bilgi amaçlı ve idempotency
   * kontrolü için (aynı ödeme kimliği tekrar bildirilirse işlem no-op'tur).
   * Tahsilat GEÇMİŞİ burada değil `subscription_charges` tablosundadır.
   */
  providerPaymentId: z.string().nullable(),
  trialEndsAt: z.coerce.date().nullable(),
  currentPeriodStart: z.coerce.date().nullable(),
  currentPeriodEnd: z.coerce.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number().int(),
})

export type Subscription = z.infer<typeof SubscriptionSchema>

export default SubscriptionSchema;
