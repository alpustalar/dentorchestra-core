import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'
import { SubscriptionChargeStatusSchema } from '../inputTypeSchemas/SubscriptionChargeStatusSchema'

/////////////////////////////////////////
// SUBSCRIPTION CHARGE SCHEMA
/////////////////////////////////////////

/**
 * Platformun abonelikten tahsil ettiği paranın DEFTERİ.
 * 
 * Neden ayrı tablo: önceden tahsilatın tek izi (a) audit log satırı ve (b) her
 * yenilemede ÜZERİNE YAZILAN `subscriptions.external_id` idi. Sonuçları:
 * iade edilemiyordu (ödeme kimliği kaybolduğu için), sağlayıcıyla mutabakat
 * yapılamıyordu, "bu ay ne tahsil ettik" sorusu cevaplanamıyordu ve en önemlisi
 * **dönem başına idempotency anahtarı yoktu**: başarılı çekimden sonra
 * transaction geri alınırsa (statement timeout, pod kill, outbox yazım hatası)
 * bir sonraki zamanlanmış çalıştırma kartı İKİNCİ KEZ çekiyordu.
 * 
 * `@@unique([subscriptionId, periodStart])` bunun DB tarafındaki kilidi: bir
 * dönem için en fazla bir tahsilat satırı. Satır çekimden ÖNCE commit edilir
 * (claim-then-charge), böylece para hareketi her zaman kaydının arkasından gelir.
 */
export const SubscriptionChargeSchema = z.object({
  currency: CurrencySchema,
  status: SubscriptionChargeStatusSchema,
  id: z.string(),
  subscriptionId: z.string(),
  organizationId: z.string(),
  /**
   * Tahsilatın karşılığı olan fatura dönemi. `periodStart` idempotency anahtarının
   * parçasıdır: aynı dönem iki kez tahsil edilemez.
   */
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  /**
   * Çekilmek ÜZERE olan tutar (bizim beyanımız).
   */
  amount: decimalSchema("Field 'amount' must be a Decimal. Location: ['Models', 'SubscriptionCharge']"),
  /**
   * Sağlayıcının fiilen tahsil ettiğini bildirdiği tutar. iyzico'da taksitli
   * ödemede `paidPrice > price` olabilir; fark mutabakatta görünmek zorundadır.
   */
  paidAmount: decimalSchema("Field 'paidAmount' must be a Decimal. Location: ['Models', 'SubscriptionCharge']").nullable(),
  /**
   * Sağlayıcı ödeme kimliği — iadenin ÖN KOŞULU.
   */
  providerPaymentId: z.string().nullable(),
  /**
   * Korelasyon anahtarı (ilk ödemede checkout `conversationId`'si).
   */
  conversationId: z.string().nullable(),
  failureReason: z.string().nullable(),
  /**
   * Kaçıncı deneme — başarısız dönem yeniden denenebilir (dunning), ama aynı
   * satır üzerinde: yeni satır açmak dönem başına tekillik kısıtını kırardı.
   */
  attempts: z.number().int(),
  chargedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type SubscriptionCharge = z.infer<typeof SubscriptionChargeSchema>

export default SubscriptionChargeSchema;
