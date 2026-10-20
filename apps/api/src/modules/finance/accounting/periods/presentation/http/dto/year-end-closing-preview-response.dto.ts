import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import {
  AccountingPeriodStatusSchema,
  AccountingPeriodStatusType,
} from '@input-type-schemas/AccountingPeriodStatusSchema';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

/**
 * Yıl sonu kapanış önizlemesi tamamen defter verisidir (hesap bazında tutarlar, tahakkuk
 * adayları, tedarikçi kimlikleri). "Klinik personeline açık" bir tabanı yoktur; tüm alanlar
 * FINANCIAL/MANAGEMENT/ADMIN tier'ındadır. Gruplar `FinancePolicy`'den gelir; yetkisiz aktörde
 * interceptor boş nesne döndürür (muhasebe raporlarıyla aynı kural).
 */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

const STEP_TYPES = [
  'GRNI_ACCRUAL',
  'COST_REFLECTION',
  'COST_REFLECTION_CLOSE',
  'CLOSE_TO_RESULT',
  'RESULT_TRANSFER',
  'EQUITY_CARRYFORWARD',
  'GRNI_REVERSAL',
] as const;

const BLOCKER_CODES = [
  'PERIOD_ALREADY_CLOSED',
  'PREVIOUS_PERIOD_NOT_CLOSED',
  'UNPOSTED_EVENTS',
  'NEXT_PERIOD_UNAVAILABLE',
  'ACCOUNTS_MISSING',
  'UNMAPPED_COST_ACCOUNT',
  'GRNI_SELECTION_INVALID',
] as const;

export class YearEndClosingLineResponseDto {
  @Expose(FIN) accountCode: string;
  @Expose(FIN) accountName: string;
  @Expose(FIN) debit: string;
  @Expose(FIN) credit: string;
  @Expose(FIN) lineDesc: string;
}

export class YearEndClosingStepResponseDto {
  @ApiProperty({ enum: STEP_TYPES })
  @Expose(FIN)
  step: (typeof STEP_TYPES)[number];

  @ApiProperty({ enum: ['ADJUSTING', 'CLOSING'] })
  @Expose(FIN)
  entryKind: 'ADJUSTING' | 'CLOSING';

  @ApiProperty({ enum: ['CLOSING_PERIOD', 'NEXT_PERIOD'] })
  @Expose(FIN)
  period: 'CLOSING_PERIOD' | 'NEXT_PERIOD';

  @Expose(FIN)
  @Type(() => Date)
  entryDate: Date;

  @Expose(FIN) description: string;

  @Expose(FIN)
  @Type(() => YearEndClosingLineResponseDto)
  lines: YearEndClosingLineResponseDto[];

  @Expose(FIN) totalDebit: string;
}

export class YearEndClosingSummaryResponseDto {
  @Expose(FIN) incomeTotal: string;
  @Expose(FIN) expenseTotal: string;
  @Expose(FIN) netResult: string;

  @ApiProperty({ enum: ['590', '591'], nullable: true })
  @Expose(FIN)
  resultAccountCode: '590' | '591' | null;

  @Expose(FIN) reflectedCostTotal: string;
  @Expose(FIN) grniAccrualTotal: string;
}

export class GrniAccrualCandidateResponseDto {
  @Expose(FIN) orderId: string;
  @Expose(FIN) supplierId: string;

  @Expose(FIN)
  @Type(() => Date)
  orderDate: Date;

  @Expose(FIN) currency: string;
  @Expose(FIN) receivedNet: string;
  @Expose(FIN) invoicedNet: string;
  @Expose(FIN) accrualAmount: string;
  @Expose(FIN) accruable: boolean;

  @ApiProperty({ enum: ['FOREIGN_CURRENCY'], nullable: true })
  @Expose(FIN)
  notAccruableReason: 'FOREIGN_CURRENCY' | null;

  @ApiProperty({ nullable: true })
  @Expose(FIN)
  suggestedDebitAccountCode: string | null;

  @Expose(FIN) includesLegacyReceipts: boolean;
}

export class InvoicedNotReceivedWarningResponseDto {
  @Expose(FIN) orderId: string;
  @Expose(FIN) supplierId: string;
  @Expose(FIN) currency: string;
  @Expose(FIN) invoicedNet: string;
  @Expose(FIN) receivedNet: string;
  @Expose(FIN) difference: string;
}

export class YearEndClosingBlockerResponseDto {
  @ApiProperty({ enum: BLOCKER_CODES })
  @Expose(FIN)
  code: (typeof BLOCKER_CODES)[number];

  @Expose(FIN) message: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @Expose(FIN)
  meta: Record<string, unknown>;
}

export class YearEndClosingWarningsResponseDto {
  @Expose(FIN) periodNotEnded: boolean;

  @Expose(FIN) businessTypeMissing: boolean;

  @Expose(FIN)
  @Type(() => InvoicedNotReceivedWarningResponseDto)
  invoicedNotReceived: InvoicedNotReceivedWarningResponseDto[];

  @Expose(FIN) unselectedGrniOrderIds: string[];
}

export class YearEndClosingPreviewResponseDto {
  @Expose(FIN) periodId: string;
  @Expose(FIN) clinicId: string;
  @Expose(FIN) year: number;

  @ApiProperty({ enum: AccountingPeriodStatusSchema.options })
  @Expose(FIN)
  periodStatus: AccountingPeriodStatusType;

  @Expose(FIN)
  @Type(() => Date)
  startsAt: Date;

  @Expose(FIN)
  @Type(() => Date)
  endsAt: Date;

  /** `POST close` bu değeri geri göndermek zorundadır. */
  @Expose(FIN) expectedLastEntryNo: string;

  @Expose(FIN)
  @Type(() => YearEndClosingSummaryResponseDto)
  summary: YearEndClosingSummaryResponseDto;

  @Expose(FIN)
  @Type(() => YearEndClosingStepResponseDto)
  steps: YearEndClosingStepResponseDto[];

  @Expose(FIN)
  @Type(() => GrniAccrualCandidateResponseDto)
  grniCandidates: GrniAccrualCandidateResponseDto[];

  @Expose(FIN)
  @Type(() => YearEndClosingBlockerResponseDto)
  blockers: YearEndClosingBlockerResponseDto[];

  @Expose(FIN)
  @Type(() => YearEndClosingWarningsResponseDto)
  warnings: YearEndClosingWarningsResponseDto;

  @Expose(FIN) canClose: boolean;
}
