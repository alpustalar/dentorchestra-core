import { z } from 'zod';

/**
 * Kart itirazı (chargeback / ters ibraz) kaydı.
 *
 * Kart sahibi bankasına itiraz ettiğinde sağlayıcı parayı üye işyerinden geri
 * keser; kayıt **sağlayıcının itiraz bildiriminden elle** girilir (bugün ne
 * iyzico ne banka POS için itiraz API'si var).
 *
 * `caseReference` sağlayıcının vaka numarasıdır ve idempotency anahtarının
 * yarısıdır (`clinicId + provider + caseReference` DB'de tekil): aynı vaka iki
 * kez girilirse 127 iki kez dolar ve 108 iki kez düşer.
 */
export const CardChargebackSourceEnum = z.enum([
  'POS_TRANSACTION',
  'ONLINE_PAYMENT',
]);

/** Paranın itiraz sırasında hangi hesaptan kesildiği / hangisine döndüğü. */
export const ChargebackFundsChannelEnum = z.enum([
  'FUNDS_IN_TRANSIT',
  'BANK',
]);

/**
 * Kuruş sınırı: DB kolonları `Decimal(14,2)`. Fazla hane sessizce yuvarlanır ve
 * fişin dengesi bozulur (§81.3).
 */
const chargebackAmount = z.number().multipleOf(0.01, {
  message: 'Tutar en fazla 2 ondalık basamak taşıyabilir',
});

export const OpenCardChargebackSchema = z.object({
  clinicId: z.uuid(),
  /** İtiraz edilen tahsilatın türü: fiziksel POS satışı ya da sanal POS taksiti. */
  sourceType: CardChargebackSourceEnum,
  /** POS_TRANSACTION → POS işlem id'si; ONLINE_PAYMENT → taksit id'si. */
  sourceId: z.uuid(),
  /** Sağlayıcının vaka numarası. */
  caseReference: z.string().trim().min(1),
  /** Paranın sağlayıcı tarafından kesildiği gün — fişin belge tarihi. */
  openedAt: z.coerce.date(),
  /** Sağlayıcının kestiği (itiraz edilen) tutar. Kısmi itiraz mümkündür. */
  amount: chargebackAmount.positive(),
  /** Sağlayıcının itiraz başına kestiği ücret → 653 (ücretsizse 0). */
  feeAmount: chargebackAmount.min(0).default(0),
  /**
   * Paranın nereden kesildiği: sağlayıcıdaki bekleyen bakiye (108) ya da
   * doğrudan banka hesabı (102).
   */
  fundsChannel: ChargebackFundsChannelEnum,
  /** Banka kesintisinde hangi hesap (opsiyonel; verilirse kiracısı doğrulanır). */
  bankAccountId: z.uuid().nullable().optional(),
  /** Delil sunma son günü. Yalnız saklanır; delil iş akışı bu kaydın işi değil. */
  evidenceDueAt: z.coerce.date().nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});
