import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ResponseGroups } from '../../../../../../../../../packages/shared/common/constants/response-groups.constant';
import { LedgerCategoryType as LedgerCategory, LedgerCategorySchema } from '@input-type-schemas/LedgerCategorySchema';
import { LedgerTypeType as LedgerType, LedgerTypeSchema } from '@input-type-schemas/LedgerTypeSchema';
import { LedgerSourceType as LedgerSource, LedgerSourceSchema } from '@input-type-schemas/LedgerSourceSchema';
import { LedgerStatusType as LedgerStatus, LedgerStatusSchema } from '@input-type-schemas/LedgerStatusSchema';

const { INTERNAL, MANAGEMENT, FINANCIAL, ADMIN } = ResponseGroups;

export class FinanceLedgerResponseDto {
  @Expose() id: string;
  @Expose() organizationId: string;
  @Expose() clinicId: string;
  @Expose() patientId: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: LedgerTypeSchema.options })
  type: LedgerType;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: LedgerSourceSchema.options })
  source: LedgerSource;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: LedgerCategorySchema.options })
  category: LedgerCategory;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: LedgerStatusSchema.options })
  status: LedgerStatus;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  description: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  documentNo: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  entryDate: Date;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  paymentId: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  installmentId: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  performedById: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  amount: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  taxRate: number;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Number)
  taxAmount: number;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  createdAt: Date;

  @Expose({ groups: [MANAGEMENT, ADMIN] })
  @Type(() => Date)
  updatedAt: Date;
}

/** Para birimi başına klinik toplamı. */
export class LedgerCurrencyTotalResponseDto {
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  totalIncome: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  totalExpenses: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  balance: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  entryCount: number;
}

/**
 * Klinik finans özeti (LedgerSummary). Ciro/gider toplamı yönetim verisidir —
 * resepsiyonun göreceği bir alan yok, tamamı finans tier'ında.
 *
 * Toplam **para birimi kırılımında** döner: tek bir `balance` alanı farklı
 * para birimlerini topluyordu.
 */
export class LedgerSummaryResponseDto {
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => LedgerCurrencyTotalResponseDto)
  totals: LedgerCurrencyTotalResponseDto[];

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  entryCount: number;
}

/** Hastanın para birimi başına bakiyesi. */
export class PatientCurrencyBalanceResponseDto {
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;

  /** Kalan bakiye tahsilat yapan resepsiyonun da görmesi gereken bilgidir. */
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  balance: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  totalServiceAmount: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  totalPayments: string;
}

/** Hasta cari özeti (PatientFinanceSummary). */
export class PatientFinanceSummaryResponseDto {
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => PatientCurrencyBalanceResponseDto)
  balances: PatientCurrencyBalanceResponseDto[];
}

/** Hasta cari hareketi (PatientLedgerItem read-model). */
export class PatientLedgerItemResponseDto {
  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  id: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  category: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  entryDate: Date;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  status: string;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  description: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  paymentMethod: string | null;

  @Expose({ groups: [INTERNAL, FINANCIAL, MANAGEMENT, ADMIN] })
  providerName: string | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  amount: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;
}

/**
 * Cari defter mutabakat satırı (LedgerMismatchRow). Tamamı finans/yönetim
 * verisidir: hangi tahsilatın defterde eksik olduğu operasyonel bir açıktır.
 */
export class LedgerMismatchResponseDto {
  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  installmentId: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  paymentId: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  clinicId: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  patientId: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  kind: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: LedgerStatusSchema.options })
  expectedStatus: LedgerStatus;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @ApiProperty({ enum: LedgerStatusSchema.options, nullable: true })
  ledgerStatus: LedgerStatus | null;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => Date)
  settledAt: Date;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  @Type(() => String)
  amount: string;

  @Expose({ groups: [FINANCIAL, MANAGEMENT, ADMIN] })
  currency: string;
}
