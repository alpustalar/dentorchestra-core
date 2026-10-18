import { Expose, Type } from 'class-transformer';
import { FinanceResponseGroups } from '@modules/finance/shared/domain/finance.contracts';
import { AccountSideType } from '@input-type-schemas/AccountSideSchema';
import { CurrencyType } from '@input-type-schemas/CurrencySchema';
import { JournalEntryStatusType } from '@input-type-schemas/JournalEntryStatusSchema';

const { FINANCIAL, MANAGEMENT, ADMIN } = FinanceResponseGroups;

/**
 * Muhasebe raporlarının tamamı defter verisidir — mizan, defter-i kebir, yevmiye,
 * gelir tablosu, bilanço, nakit akışı ve KDV. Hiçbirinin "klinik personeline açık"
 * bir tabanı yoktur; bu yüzden tüm alanlar FINANCIAL/MANAGEMENT/ADMIN tier'ındadır.
 * Grupları FinancePolicy üretir; yetkisiz aktörde interceptor boş nesne döndürür.
 */
const FIN = { groups: [FINANCIAL, MANAGEMENT, ADMIN] };

// ─────────────────────────────── MİZAN ───────────────────────────────

export class TrialBalanceLineResponseDto {
  @Expose(FIN) accountId: string;
  @Expose(FIN) code: string;
  @Expose(FIN) name: string;
  @Expose(FIN) totalDebit: string;
  @Expose(FIN) totalCredit: string;
  @Expose(FIN) debitBalance: string;
  @Expose(FIN) creditBalance: string;
}

export class TrialBalanceTotalsResponseDto {
  @Expose(FIN) totalDebit: string;
  @Expose(FIN) totalCredit: string;
  @Expose(FIN) debitBalance: string;
  @Expose(FIN) creditBalance: string;
}

export class TrialBalanceReportResponseDto {
  @Expose(FIN) clinicId: string;

  @Expose(FIN)
  @Type(() => Date)
  dateFrom: Date | null;

  @Expose(FIN)
  @Type(() => Date)
  dateTo: Date | null;

  @Expose(FIN)
  @Type(() => TrialBalanceLineResponseDto)
  lines: TrialBalanceLineResponseDto[];

  @Expose(FIN)
  @Type(() => TrialBalanceTotalsResponseDto)
  totals: TrialBalanceTotalsResponseDto;

  @Expose(FIN) isBalanced: boolean;
}

// ────────────────────────── DEFTER-İ KEBİR ───────────────────────────

export class LedgerAccountHeaderResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) code: string;
  @Expose(FIN) name: string;
  @Expose(FIN) normalSide: AccountSideType;
}

export class LedgerMovementResponseDto {
  @Expose(FIN) entryId: string;
  @Expose(FIN) entryNo: string | null;

  @Expose(FIN)
  @Type(() => Date)
  entryDate: Date;

  @Expose(FIN) description: string | null;
  @Expose(FIN) lineDesc: string | null;
  @Expose(FIN) debit: string;
  @Expose(FIN) credit: string;
  @Expose(FIN) runningBalance: string;
}

export class AccountLedgerReportResponseDto {
  @Expose(FIN) clinicId: string;
  @Expose(FIN) currency: CurrencyType;

  @Expose(FIN)
  @Type(() => LedgerAccountHeaderResponseDto)
  account: LedgerAccountHeaderResponseDto;

  @Expose(FIN)
  @Type(() => Date)
  dateFrom: Date | null;

  @Expose(FIN)
  @Type(() => Date)
  dateTo: Date | null;

  @Expose(FIN) openingBalance: string;

  @Expose(FIN)
  @Type(() => LedgerMovementResponseDto)
  movements: LedgerMovementResponseDto[];

  @Expose(FIN) totalDebit: string;
  @Expose(FIN) totalCredit: string;
  @Expose(FIN) closingBalance: string;
}

// ─────────────────────────────── YEVMİYE ─────────────────────────────

export class JournalReportLineResponseDto {
  @Expose(FIN) accountId: string;
  @Expose(FIN) code: string;
  @Expose(FIN) name: string;
  @Expose(FIN) partyId: string | null;
  @Expose(FIN) debit: string;
  @Expose(FIN) credit: string;
  @Expose(FIN) lineDesc: string | null;
}

export class JournalReportEntryResponseDto {
  @Expose(FIN) id: string;
  @Expose(FIN) entryNo: string | null;

  @Expose(FIN)
  @Type(() => Date)
  entryDate: Date;

  @Expose(FIN) description: string | null;
  @Expose(FIN) status: JournalEntryStatusType;

  @Expose(FIN)
  @Type(() => JournalReportLineResponseDto)
  lines: JournalReportLineResponseDto[];

  @Expose(FIN) totalDebit: string;
  @Expose(FIN) totalCredit: string;
}

// ───────────────────── GELİR TABLOSU / BİLANÇO ───────────────────────

/** Gelir tablosu ve bilanço aynı satır/bölüm şeklini paylaşır. */
export class FinancialStatementLineResponseDto {
  @Expose(FIN) code: string;
  @Expose(FIN) name: string;
  @Expose(FIN) amount: string;
}

export class FinancialStatementSectionResponseDto {
  @Expose(FIN)
  @Type(() => FinancialStatementLineResponseDto)
  lines: FinancialStatementLineResponseDto[];

  @Expose(FIN) total: string;
}

/** Önceki dönemin ana satırları — kalem dökümü tekrarlanmaz. */
export class IncomeStatementPeriodTotalsResponseDto {
  @Expose(FIN)
  @Type(() => Date)
  dateFrom: Date;

  @Expose(FIN)
  @Type(() => Date)
  dateTo: Date;

  @Expose(FIN) netSales: string;
  @Expose(FIN) grossProfit: string;
  @Expose(FIN) operatingProfit: string;
  @Expose(FIN) netProfit: string;
}

export class IncomeStatementDeltasResponseDto {
  @Expose(FIN) netSalesPct: number;
  @Expose(FIN) grossProfitPct: number;
  @Expose(FIN) operatingProfitPct: number;
  @Expose(FIN) netProfitPct: number;
}

export class IncomeStatementComparisonResponseDto {
  @Expose(FIN)
  @Type(() => IncomeStatementPeriodTotalsResponseDto)
  previous: IncomeStatementPeriodTotalsResponseDto;

  @Expose(FIN)
  @Type(() => IncomeStatementDeltasResponseDto)
  deltas: IncomeStatementDeltasResponseDto;
}

export class IncomeStatementReportResponseDto {
  @Expose(FIN) clinicId: string;

  @Expose(FIN)
  @Type(() => Date)
  dateFrom: Date | null;

  @Expose(FIN)
  @Type(() => Date)
  dateTo: Date | null;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  grossSales: FinancialStatementSectionResponseDto;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  salesDeductions: FinancialStatementSectionResponseDto;

  @Expose(FIN) netSales: string;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  costOfSales: FinancialStatementSectionResponseDto;

  @Expose(FIN) grossProfit: string;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  operatingExpenses: FinancialStatementSectionResponseDto;

  @Expose(FIN) operatingProfit: string;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  otherIncome: FinancialStatementSectionResponseDto;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  otherExpense: FinancialStatementSectionResponseDto;

  @Expose(FIN) netProfit: string;

  @Expose(FIN)
  @Type(() => IncomeStatementComparisonResponseDto)
  comparison: IncomeStatementComparisonResponseDto | null;
}

export class BalanceSheetReportResponseDto {
  @Expose(FIN) clinicId: string;

  /** Bilanço bir **an** raporu: tek tarih taşır (aralık değil). */
  @Expose(FIN)
  @Type(() => Date)
  asOf: Date | null;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  currentAssets: FinancialStatementSectionResponseDto;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  nonCurrentAssets: FinancialStatementSectionResponseDto;

  @Expose(FIN) totalAssets: string;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  shortTermLiabilities: FinancialStatementSectionResponseDto;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  longTermLiabilities: FinancialStatementSectionResponseDto;

  @Expose(FIN)
  @Type(() => FinancialStatementSectionResponseDto)
  equity: FinancialStatementSectionResponseDto;

  @Expose(FIN) periodResult: string;
  @Expose(FIN) totalLiabilitiesAndEquity: string;
  @Expose(FIN) isBalanced: boolean;
}

// ────────────────────────── NAKİT AKIŞI / KDV ────────────────────────

export class CashFlowMonthResponseDto {
  @Expose(FIN) month: string;
  @Expose(FIN) inflow: string;
  @Expose(FIN) outflow: string;
  @Expose(FIN) net: string;
  @Expose(FIN) closingBalance: string;
}

export class CashFlowTotalsResponseDto {
  @Expose(FIN) inflow: string;
  @Expose(FIN) outflow: string;
  @Expose(FIN) net: string;
}

export class CashFlowReportResponseDto {
  @Expose(FIN) clinicId: string;

  @Expose(FIN)
  @Type(() => Date)
  dateFrom: Date | null;

  @Expose(FIN)
  @Type(() => Date)
  dateTo: Date | null;

  @Expose(FIN) openingBalance: string;
  @Expose(FIN) closingBalance: string;

  @Expose(FIN)
  @Type(() => CashFlowMonthResponseDto)
  months: CashFlowMonthResponseDto[];

  @Expose(FIN)
  @Type(() => CashFlowTotalsResponseDto)
  totals: CashFlowTotalsResponseDto;
}

export class VatDeclarationMonthResponseDto {
  @Expose(FIN) month: string;
  @Expose(FIN) outputVat: string;
  @Expose(FIN) inputVat: string;
  @Expose(FIN) net: string;
}

export class VatDeclarationReportResponseDto {
  @Expose(FIN) clinicId: string;

  @Expose(FIN)
  @Type(() => Date)
  dateFrom: Date | null;

  @Expose(FIN)
  @Type(() => Date)
  dateTo: Date | null;

  @Expose(FIN) outputVat: string;
  @Expose(FIN) inputVat: string;
  @Expose(FIN) netVat: string;
  @Expose(FIN) payableVat: string;
  @Expose(FIN) carryForwardVat: string;

  @Expose(FIN)
  @Type(() => VatDeclarationMonthResponseDto)
  months: VatDeclarationMonthResponseDto[];
}
