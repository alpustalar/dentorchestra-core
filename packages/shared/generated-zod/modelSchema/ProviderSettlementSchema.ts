import { z } from 'zod';
import { decimalSchema } from '../../common/decimal';
import { SettlementProviderSchema } from '../inputTypeSchemas/SettlementProviderSchema'
import { CurrencySchema } from '../inputTypeSchemas/CurrencySchema'

/////////////////////////////////////////
// PROVIDER SETTLEMENT SCHEMA
/////////////////////////////////////////

export const ProviderSettlementSchema = z.object({
  provider: SettlementProviderSchema,
  currency: CurrencySchema,
  id: z.string(),
  organizationId: z.string(),
  clinicId: z.string(),
  /**
   * Sağlayıcının payout referansı — kiracı+sağlayıcı içinde tekil (idempotency).
   */
  reference: z.string(),
  /**
   * Paranın hesaba geçtiği gün — fişin belge tarihi (dönem kapısı buna bakar).
   */
  payoutDate: z.coerce.date(),
  /**
   * 108'den düşen brüt tutar = net + komisyon (entity'de birebir zorunlu).
   */
  grossAmount: decimalSchema("Field 'grossAmount' must be a Decimal. Location: ['Models', 'ProviderSettlement']"),
  /**
   * Sağlayıcının kestiği komisyon → 653 Komisyon Giderleri.
   */
  commissionAmount: decimalSchema("Field 'commissionAmount' must be a Decimal. Location: ['Models', 'ProviderSettlement']"),
  /**
   * Bankaya fiilen geçen tutar → 102 Bankalar.
   */
  netAmount: decimalSchema("Field 'netAmount' must be a Decimal. Location: ['Models', 'ProviderSettlement']"),
  /**
   * Hangi banka hesabına yattı (opsiyonel; verilirse kiracısı doğrulanır).
   */
  bankAccountId: z.string().nullable(),
  note: z.string().nullable(),
  /**
   * Muhasebe köprüsü izi — mükerrer fiş ve yarıda kalma koruması.
   */
  accountingEventId: z.string().nullable(),
  postedToAccountingAt: z.coerce.date().nullable(),
  recordedById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type ProviderSettlement = z.infer<typeof ProviderSettlementSchema>

export default ProviderSettlementSchema;
