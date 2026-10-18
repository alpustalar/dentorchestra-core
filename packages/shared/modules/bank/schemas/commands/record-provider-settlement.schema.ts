import { z } from 'zod';

/**
 * Sağlayıcı hesap kapaması (settlement/payout) kaydı.
 *
 * Kartla tahsil edilen para sağlayıcıda bekler; valör günü komisyon kesilerek
 * bankaya geçer. Kayıt **sağlayıcının payout raporundan** girilir (bugün API
 * yok — banka ekstresi importu da elle).
 *
 * `reference` sağlayıcının kendi payout referansıdır ve idempotency anahtarının
 * yarısıdır (`clinicId + provider + reference` DB'de tekil): aynı payout iki kez
 * girilirse 108 **iki kez** kapanır, bakiye eksiye düşer ve 102 fazla yazılır.
 */
export const SettlementProviderEnum = z.enum([
  'IYZICO',
  'IYZICO_TERMINAL',
  'PAX_BANK',
  'STRIPE',
  'OTHER',
]);

/**
 * Kuruş sınırı: DB kolonları `Decimal(14,2)`. Fazla hane sessizce yuvarlanır ve
 * `brüt = net + komisyon` eşitliği — yani fişin dengesi — bozulur (§81.3).
 */
const settlementAmount = z.number().multipleOf(0.01, {
  message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
});

export const RecordProviderSettlementSchema = z
  .object({
    clinicId: z.uuid(),
    provider: SettlementProviderEnum,
    reference: z.string().trim().min(1),
    /** Paranın hesaba geçtiği gün — fişin belge tarihi (dönem kapısı buna bakar). */
    payoutDate: z.coerce.date(),
    /** 108'den düşen brüt tutar. */
    grossAmount: settlementAmount.positive(),
    /** Sağlayıcının kestiği komisyon → 653 (kesintisiz payout'ta 0). */
    commissionAmount: settlementAmount.min(0),
    /** Bankaya fiilen geçen tutar → 102. */
    netAmount: settlementAmount.positive(),
    bankAccountId: z.uuid().nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (data) =>
      // Kuruş cinsinden karşılaştırılır: 0.1 + 0.2 === 0.30000000000000004
      // olduğu için ondalık toplamı doğrudan eşitlemek sağlam değildir.
      Math.round(data.grossAmount * 100) ===
      Math.round(data.netAmount * 100) +
        Math.round(data.commissionAmount * 100),
    {
      message:
        'Brüt tutar net + komisyona eşit olmalı — bu eşitlik fişin dengesidir.',
      path: ['grossAmount'],
    }
  );
