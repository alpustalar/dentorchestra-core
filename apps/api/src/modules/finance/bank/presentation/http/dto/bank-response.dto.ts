import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import { CurrencyType, CurrencySchema } from '@input-type-schemas/CurrencySchema';
import { BankAccountStatusType, BankAccountStatusSchema } from '@input-type-schemas/BankAccountStatusSchema';
import { BankStatementLineMatchStatusType, BankStatementLineMatchStatusSchema } from '@input-type-schemas/BankStatementLineMatchStatusSchema';
import { BankStatementLineMatchSourceType, BankStatementLineMatchSourceSchema } from '@input-type-schemas/BankStatementLineMatchSourceSchema';
import { SettlementProviderType, SettlementProviderSchema } from '@input-type-schemas/SettlementProviderSchema';
import { CardChargebackSourceType, CardChargebackSourceSchema } from '@input-type-schemas/CardChargebackSourceSchema';
import { CardChargebackStatusType, CardChargebackStatusSchema } from '@input-type-schemas/CardChargebackStatusSchema';
import { ChargebackFundsChannelType, ChargebackFundsChannelSchema } from '@input-type-schemas/ChargebackFundsChannelSchema';
import { CardChargebackPlanSyncType, CardChargebackPlanSyncSchema } from '@input-type-schemas/CardChargebackPlanSyncSchema';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

/**
 * Banka verisi (hesap, ekstre, satır, mutabakat) baştan sona finansaldır —
 * muhasebe raporlarıyla aynı hizada tabansız tutulur. IBAN ve bakiye gibi alanlar
 * klinik personelinin günlük işine girmez.
 */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

/** Banka hesabı. IBAN/hesap no ödeme talimatı üretebildiği için yönetime kapalıdır. */
export class BankAccountResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) clinicId: string;
  @Expose(FIN) name: string;
  @Expose(FIN) bankName: string;
  @ApiProperty({ enum: CurrencySchema.options })
  @Expose(FIN) currency: CurrencyType;
  @ApiProperty({ enum: BankAccountStatusSchema.options })
  @Expose(FIN) status: BankAccountStatusType;

  @Expose(FIN)
  @Type(() => String)
  openingBalance: string;

  // --- Ödeme talimatı üretebilen kimlikler (yönetim) ---
  @Expose({ groups: [MANAGEMENT, ADMIN] })
  iban: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  accountNo: string | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Ekstre satırı — imzalı tutar (+ giriş / − çıkış) + mutabakat durumu. */
export class BankStatementLineResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) bankStatementId: string;
  @Expose(FIN) bankAccountId: string;
  @Expose(FIN) clinicId: string;

  @Expose(FIN)
  @Type(() => Date)
  transactionDate: Date;

  @Expose(FIN) description: string;

  @Expose(FIN)
  @Type(() => String)
  amount: string;

  @Expose(FIN)
  @Type(() => String)
  balanceAfter: string | null;

  @Expose(FIN) reference: string | null;
  @Expose(FIN) counterpartyName: string | null;

  // --- Mutabakat izi ---
  @ApiProperty({ enum: BankStatementLineMatchStatusSchema.options })
  @Expose(FIN) matchStatus: BankStatementLineMatchStatusType;
  @Expose(FIN) matchedRef: string | null;
  @Expose(FIN) matchNote: string | null;
  @ApiProperty({ enum: BankStatementLineMatchSourceSchema.options })
  @Expose(FIN) matchSource: BankStatementLineMatchSourceType;
  @Expose(FIN) reconciledById: string | null;

  @Expose(FIN)
  @Type(() => Date)
  reconciledAt: Date | null;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;
}

/** Banka ekstresi. `lines` yalnız detay sorgusunda dolar (BankStatementWithLines). */
export class BankStatementResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) bankAccountId: string;
  @Expose(FIN) clinicId: string;

  @Expose(FIN)
  @Type(() => Date)
  periodStart: Date;

  @Expose(FIN)
  @Type(() => Date)
  periodEnd: Date;

  @Expose(FIN)
  @Type(() => String)
  openingBalance: string | null;

  @Expose(FIN)
  @Type(() => String)
  closingBalance: string | null;

  @Expose(FIN) fileName: string | null;
  @Expose(FIN) importedById: string | null;

  @Expose(FIN)
  @Type(() => BankStatementLineResponseDto)
  lines?: BankStatementLineResponseDto[];

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  organizationId: string;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;
}

/** Bir ekstrenin mutabakat özeti — satır sayıları + tutar toplamları. */
export class ReconciliationSummaryResponseDto {
  @Expose(FIN) bankStatementId: string;
  @Expose(FIN) totalLines: number;
  @Expose(FIN) matchedCount: number;
  @Expose(FIN) unmatchedCount: number;
  @Expose(FIN) ignoredCount: number;
  @Expose(FIN) statementNet: string;
  @Expose(FIN) matchedNet: string;
  @Expose(FIN) unmatchedNet: string;
}

/** Oto-eşleştirme adayı — bir ekstre satırına önerilen defter hareketi. */
export class LineMatchSuggestionResponseDto {
  @Expose(FIN) matchedRef: string;
  @Expose(FIN) entryId: string;
  @Expose(FIN) entryNo: string | null;

  @Expose(FIN)
  @Type(() => Date)
  entryDate: Date;

  @Expose(FIN) description: string | null;
  @Expose(FIN) amount: string;
  @Expose(FIN) score: number;
  @Expose(FIN) dayDifference: number;
  @Expose(FIN) reason: string;
  @Expose(FIN) alreadyUsed: boolean;
}

/**
 * Kart itirazı (chargeback). Tutarlar ve hasta/plan kimlikleri finansaldır —
 * ekstre/hesap kapaması ile aynı hizada tabansız tutulur. Vaka numarası, delil
 * son günü ve notlar operasyonun günlük işidir; personel kimlikleri ve muhasebe
 * köprüsü izleri yönetime kapalıdır.
 */
export class CardChargebackResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) clinicId: string;
  @ApiProperty({ enum: SettlementProviderSchema.options })
  @Expose(FIN) provider: SettlementProviderType;
  @Expose(FIN) caseReference: string;

  // --- Kaynak tahsilat ---
  @ApiProperty({ enum: CardChargebackSourceSchema.options })
  @Expose(FIN) sourceType: CardChargebackSourceType;
  @Expose(FIN) sourceId: string;
  @Expose(FIN) paymentId: string | null;
  @Expose(FIN) installmentId: string | null;
  @Expose(FIN) patientId: string | null;

  @Expose(FIN)
  @Type(() => String)
  amount: string;

  @Expose(FIN)
  @Type(() => String)
  feeAmount: string;

  @ApiProperty({ enum: CurrencySchema.options })
  @Expose(FIN) currency: CurrencyType;
  @ApiProperty({ enum: CardChargebackStatusSchema.options })
  @Expose(FIN) status: CardChargebackStatusType;

  // --- Açılış ---
  @Expose(FIN)
  @Type(() => Date)
  openedAt: Date;

  @ApiProperty({ enum: ChargebackFundsChannelSchema.options })
  @Expose(FIN) openedFundsChannel: ChargebackFundsChannelType;
  @Expose(FIN) openedBankAccountId: string | null;

  @Expose(FIN)
  @Type(() => Date)
  evidenceDueAt: Date | null;

  @Expose(FIN) note: string | null;

  // --- Sonuç ---
  @Expose(FIN)
  @Type(() => Date)
  resolvedAt: Date | null;

  @ApiProperty({ enum: ChargebackFundsChannelSchema.options, nullable: true })
  @Expose(FIN) resolvedFundsChannel: ChargebackFundsChannelType | null;
  @Expose(FIN) resolvedBankAccountId: string | null;
  @Expose(FIN) resolutionNote: string | null;

  // --- Ödeme planına yansıma (yalnız LOST) ---
  @ApiProperty({ enum: CardChargebackPlanSyncSchema.options, nullable: true })
  @Expose(FIN) planSyncStatus: CardChargebackPlanSyncType | null;
  @Expose(FIN) recoveryInstallmentId: string | null;

  // --- Yönetim: kim kaydetti / çözdü, köprü izleri ---
  @Expose({ groups: [MANAGEMENT, ADMIN] }) partyId: string | null;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) organizationId: string;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) recordedById: string;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) resolvedById: string | null;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) openedEventId: string | null;
  @Expose({ groups: [MANAGEMENT, ADMIN] }) resolvedEventId: string | null;

  @Expose(FIN)
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}
