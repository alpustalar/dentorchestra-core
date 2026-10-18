import { Decimal } from 'decimal.js';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { SettlementProviderType } from '@input-type-schemas/SettlementProviderSchema';

/**
 * Sağlayıcı hesap kapaması kaydı — entity `record()` girişi.
 *
 * Tutarlar `Decimal`: sağlayıcının payout raporundan okunur ve **brüt = net +
 * komisyon** birebir tutmak zorundadır (tolerans yok — bu bizim hesabımız değil,
 * sağlayıcının kendi raporudur; tutmuyorsa veri girişi hatalıdır).
 */
export interface RecordProviderSettlementProps {
  /** Optional UUID; auto-generated if omitted. */
  id?: string;
  clinicId: string;
  organizationId: string;
  provider: SettlementProviderType;
  /** Sağlayıcının payout referansı — kiracı+sağlayıcı içinde tekil. */
  reference: string;
  /** Paranın hesaba geçtiği gün (fişin belge tarihi). */
  payoutDate: Date;
  grossAmount: Decimal;
  commissionAmount: Decimal;
  netAmount: Decimal;
  currency: CurrencyType;
  bankAccountId?: string | null;
  note?: string | null;
  recordedById: string;
}

/** Muhasebe köprüsü izi — fiş üretildikten sonra damgalanır. */
export interface MarkSettlementPostedProps {
  accountingEventId: string;
}
