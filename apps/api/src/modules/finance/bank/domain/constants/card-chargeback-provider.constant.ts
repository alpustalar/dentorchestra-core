import type { PosProviderType } from '@input-type-schemas/PosProviderSchema';
import type { SettlementProviderType } from '@input-type-schemas/SettlementProviderSchema';

/**
 * Fiziksel POS cihazının sağlayıcısı → kart itirazının sağlayıcısı (payout /
 * itiraz bildiriminin geldiği taraf). İtirazın `(clinicId, provider,
 * caseReference)` idempotency anahtarı bu değerle kurulur; yani eşleme, payout
 * kaydıyla (`SettlementProvider`) AYNI kümeden okunur.
 *
 * `Record<PosProviderType, …>` tam kaplama zorunlu kılar: POS'a yeni bir sağlayıcı
 * eklenirse eşleme eksikliği **derleme hatasıdır**, itirazın yanlış sağlayıcıya
 * yazılması değil.
 *
 *  - `PAX`             → PAX_BANK: PAX terminali bir bankaya bağlıdır; itiraz da o banka bildirir
 *  - `IYZICO_TERMINAL` → IYZICO_TERMINAL
 */
export const CHARGEBACK_PROVIDER_BY_POS_PROVIDER: Record<
  PosProviderType,
  SettlementProviderType
> = {
  PAX: 'PAX_BANK',
  IYZICO_TERMINAL: 'IYZICO_TERMINAL',
};

/** Sanal POS (iyzico checkout) tahsilatı — itirazı iyzico bildirir. */
export const CHARGEBACK_PROVIDER_ONLINE: SettlementProviderType = 'IYZICO';
