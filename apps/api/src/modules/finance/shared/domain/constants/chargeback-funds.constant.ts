import { ChargebackFundsChannelSchema } from '@shared/generated-zod';
import type { ChargebackFundsChannelType } from '@input-type-schemas/ChargebackFundsChannelSchema';
import { ACCOUNTING_RULES } from './accounting-rules.constant';

const { TARGET_ACCOUNTS } = ACCOUNTING_RULES;

/**
 * Kart itirazında paranın **hangi hesaptan kesildiği / hangisine döndüğü** —
 * tek kaynak.
 *
 * Kabul kümesi Prisma enum'undan (`ChargebackFundsChannel`) gelir; yazma kapısı
 * (olay gövdesi şeması) ve kullanım yeri (posting kuralı) bu tek sabitten okur
 * (CLAUDE.md finans kuralı 12). `Record<ChargebackFundsChannelType, …>` tam
 * kaplama zorunlu kılar: enum'a yeni bir kanal eklenirse eşleme eksikliği
 * **derleme hatasıdır**, sessizce yanlış hesaba yazılması değil.
 *
 *  - `FUNDS_IN_TRANSIT` → 108: sağlayıcıdaki bekleyen bakiyeden kesildi
 *  - `BANK`             → 102: doğrudan banka hesabından çekildi
 */
export const CHARGEBACK_FUNDS_ACCOUNT: Record<
  ChargebackFundsChannelType,
  string
> = {
  FUNDS_IN_TRANSIT: TARGET_ACCOUNTS.POS_108,
  BANK: TARGET_ACCOUNTS.BANKS_102,
};

/** Zod enum'u olay gövdesi şemasının kabul kümesi (`z.enum(...)` için). */
export const CHARGEBACK_FUNDS_CHANNELS = ChargebackFundsChannelSchema.options;

/**
 * Kanalın defter hesabını çözer. Tanımsız kanal sessizce varsayılan bir hesaba
 * değil hataya gider (bkz. `resolvePaymentFundsAccount` ile aynı tercih) —
 * yalnız tip sistemini atlatan bir çağrı buraya `null` düşürebilir.
 */
export function resolveChargebackFundsAccount(channel: string): string | null {
  const known = CHARGEBACK_FUNDS_CHANNELS.find((c) => c === channel);
  return known ? CHARGEBACK_FUNDS_ACCOUNT[known] : null;
}
