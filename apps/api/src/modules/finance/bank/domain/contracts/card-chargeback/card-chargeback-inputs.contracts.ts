import { Decimal } from 'decimal.js';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';
import type { SettlementProviderType } from '@input-type-schemas/SettlementProviderSchema';
import type { CardChargebackSourceType } from '@input-type-schemas/CardChargebackSourceSchema';
import type { ChargebackFundsChannelType } from '@input-type-schemas/ChargebackFundsChannelSchema';
import type { CardChargebackPlanSyncType } from '@input-type-schemas/CardChargebackPlanSyncSchema';

/**
 * Kart itirazı kaydı — entity `open()` girişi.
 *
 * Tutarlar `Decimal`: sağlayıcının itiraz bildiriminden okunur; kuruş ölçeği ve
 * işaret entity'de zorlanır. `partyId` açılışta garanti edilir (hasta carisi) —
 * kaybedilince `B 120` bu cariye yazılır.
 */
export interface OpenCardChargebackProps {
  /** Optional UUID; auto-generated if omitted. */
  id?: string;
  clinicId: string;
  organizationId: string;
  provider: SettlementProviderType;
  /** Sağlayıcının vaka numarası — kiracı+sağlayıcı içinde tekil. */
  caseReference: string;
  sourceType: CardChargebackSourceType;
  /** POS_TRANSACTION → POS işlem id'si; ONLINE_PAYMENT → taksit id'si; BOOKING_PAYMENT → rezervasyon ödemesi id'si. */
  sourceId: string;
  /** Bağlı ödeme planı; plansız kart çekiminde null. */
  paymentId: string | null;
  /** `BOOKING_PAYMENT` kaynağında null (platform müşterisi hasta kaydı değildir); diğerlerinde zorunlu. */
  patientId: string | null;
  /** `BOOKING_PAYMENT` kaynağında null (kayıp 659.01'e yazılır); diğerlerinde zorunlu. */
  partyId: string | null;
  amount: Decimal;
  feeAmount: Decimal;
  currency: CurrencyType;
  /** Paranın sağlayıcı tarafından kesildiği gün — fişin belge tarihi. */
  openedAt: Date;
  openedFundsChannel: ChargebackFundsChannelType;
  openedBankAccountId?: string | null;
  evidenceDueAt?: Date | null;
  note?: string | null;
  recordedById: string;
}

/** İtirazın KAZANILMASI — para geri geldi. */
export interface ResolveChargebackWonProps {
  resolvedAt: Date;
  /** Kazanılan paranın döndüğü yer (açılıştakinden farklı olabilir). */
  fundsChannel: ChargebackFundsChannelType;
  bankAccountId?: string | null;
  note?: string | null;
  resolvedById: string;
}

/** İtirazın KAYBEDİLMESİ — kesinleşti; para dönmez. */
export interface ResolveChargebackLostProps {
  resolvedAt: Date;
  note?: string | null;
  resolvedById: string;
}

/** Muhasebe köprüsü izi — fiş üretildikten sonra damgalanır. */
export interface MarkChargebackPostedProps {
  accountingEventId: string;
}

/** Kaybedilen itirazın ödeme planına yansıma sonucu. */
export interface RecordChargebackPlanSyncProps {
  status: CardChargebackPlanSyncType;
  /** Geri alınan taksit (yansıdıysa; POS'ta tutar eşleşmesiyle bulunur). */
  installmentId?: string | null;
  /** Açılan telafi taksidi (yansıdıysa). */
  recoveryInstallmentId?: string | null;
}
