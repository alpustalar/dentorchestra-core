import { Decimal } from 'decimal.js';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';

/**
 * Tahsilat satırının açılış girdisi — para hareketinden **önce** yazılır (claim).
 *
 * `periodStart` idempotency anahtarının parçasıdır: DB'deki
 * `@@unique([subscriptionId, periodStart])` aynı dönemin iki kez tahsil
 * edilmesini imkânsız kılar.
 */
export interface ClaimSubscriptionChargeProps {
  id?: string;
  subscriptionId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  amount: Decimal;
  currency: CurrencyType;
  /** İlk ödemede checkout korelasyon anahtarı; yenilemede yok. */
  conversationId?: string | null;
}
