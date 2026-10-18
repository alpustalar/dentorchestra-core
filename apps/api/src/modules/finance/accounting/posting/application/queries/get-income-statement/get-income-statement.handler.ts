import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import {
  IJournalQueryRepository,
  JOURNAL_QUERY_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import {
  AccountBalanceInput,
  IncomeStatementCalculator,
  IncomeStatementResult,
  IncomeStatementSection,
} from '@modules/finance/accounting/posting/domain/reporting/income-statement.calculator';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetIncomeStatementQuery } from './get-income-statement.query';
import {
  GetIncomeStatementResponse,
  IncomeStatementComparison,
  IncomeStatementReportSection,
} from './get-income-statement.response';
import { Account } from '@shared';
import { IGetContext } from '@common/decorators';
import { resolvePreviousPeriod } from '@modules/finance/accounting/posting/domain/reporting/previous-period.calculator';
import { INCOME_STATEMENT_ENTRY_KINDS } from '@modules/finance/accounting/posting/domain/posting/ledger-entry-kind.constant';

interface PeriodRange {
  dateFrom: Date;
  dateTo: Date;
}

interface ComputePeriodInput {
  clinicId: string;
  ctx: IGetContext;
  dateFrom?: Date;
  dateTo?: Date;
}

@QueryHandler(GetIncomeStatementQuery)
export class GetIncomeStatementHandler implements IQueryHandler<
  GetIncomeStatementQuery,
  GetIncomeStatementResponse
> {
  constructor(
    @Inject(JOURNAL_QUERY_REPOSITORY)
    private readonly journalQueryRepo: IJournalQueryRepository,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetIncomeStatementQuery
  ): Promise<GetIncomeStatementResponse> {
    const { clinicId, ctx, dateFrom, dateTo, compare } = query.payload;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin gelir tablosuna erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.INCOME_STATEMENT);

    const serializationOptions = policy.getSerializationOptions({ clinicId });

    const r = await this.computePeriod({ clinicId, ctx, dateFrom, dateTo });

    const comparison = await this.buildComparison({
      clinicId,
      ctx,
      current: r,
      range: this.previousRangeOf({ compare, dateFrom, dateTo }),
    });

    return {
      data: {
        clinicId,
        dateFrom: dateFrom ?? null,
        dateTo: dateTo ?? null,
        grossSales: this.toSection(r.grossSales),
        salesDeductions: this.toSection(r.salesDeductions),
        netSales: r.netSales.toFixed(2),
        costOfSales: this.toSection(r.costOfSales),
        grossProfit: r.grossProfit.toFixed(2),
        operatingExpenses: this.toSection(r.operatingExpenses),
        operatingProfit: r.operatingProfit.toFixed(2),
        otherIncome: this.toSection(r.otherIncome),
        otherExpense: this.toSection(r.otherExpense),
        netProfit: r.netProfit.toFixed(2),
        comparison,
      },
      meta: { serializationOptions },
    };
  }

  /**
   * Karşılaştırma yalnız kapalı bir aralık verildiğinde anlamlıdır — açık uçlu
   * raporun "öncesi" tanımsızdır, o yüzden sessizce atlanır. Dönem seçimi
   * takvim-ayı farkındadır (bkz. `resolvePreviousPeriod`).
   */
  private previousRangeOf(input: {
    compare?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  }): PeriodRange | null {
    if (!input.compare || !input.dateFrom || !input.dateTo) return null;

    return resolvePreviousPeriod({
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    });
  }

  private async buildComparison(input: {
    clinicId: string;
    ctx: IGetContext;
    current: IncomeStatementResult;
    range: PeriodRange | null;
  }): Promise<IncomeStatementComparison | null> {
    if (!input.range) return null;

    const previous = await this.computePeriod({
      clinicId: input.clinicId,
      ctx: input.ctx,
      dateFrom: input.range.dateFrom,
      dateTo: input.range.dateTo,
    });

    return {
      previous: {
        dateFrom: input.range.dateFrom,
        dateTo: input.range.dateTo,
        netSales: previous.netSales.toFixed(2),
        grossProfit: previous.grossProfit.toFixed(2),
        operatingProfit: previous.operatingProfit.toFixed(2),
        netProfit: previous.netProfit.toFixed(2),
      },
      deltas: {
        netSalesPct: this.pctChange(previous.netSales, input.current.netSales),
        grossProfitPct: this.pctChange(
          previous.grossProfit,
          input.current.grossProfit
        ),
        operatingProfitPct: this.pctChange(
          previous.operatingProfit,
          input.current.operatingProfit
        ),
        netProfitPct: this.pctChange(
          previous.netProfit,
          input.current.netProfit
        ),
      },
    };
  }

  private async computePeriod(
    input: ComputePeriodInput
  ): Promise<IncomeStatementResult> {
    // Kapanış fişi dışarıda: 6/7'yi sıfırlayan teknik kayıt sayılırsa kapanmış
    // yılın gelir tablosu **sıfır ciro** gösterir. Bilanço aynı veriye zıt
    // süzgeçle bakar (kapanışı sayar) — bkz. INCOME_STATEMENT_ENTRY_KINDS.
    const rows = await this.journalQueryRepo.trialBalance({
      clinicId: input.clinicId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      kinds: INCOME_STATEMENT_ENTRY_KINDS,
    });

    const { data: accounts } = await this.queryBus.execute(
      new GetChartOfAccountsQuery(input.clinicId, input.ctx)
    );
    const accountById = new Map<string, Account>(
      accounts.map((account) => [account.id, account])
    );

    const balances: AccountBalanceInput[] = rows.map((row) => {
      const account = accountById.get(row.accountId);

      return {
        code: account?.code ?? '?',
        name: account?.name ?? '(bilinmeyen hesap)',
        debit: row.totalDebit,
        credit: row.totalCredit,
      };
    });

    return IncomeStatementCalculator.compute(balances);
  }

  /**
   * Yüzde değişim. Önceki dönem sıfırsa oran tanımsızdır; "sıfırdan artış" %100,
   * "sıfırdan sıfıra" %0 kabul edilir (Ajans ROI raporuyla aynı sözleşme).
   * Önceki değer negatifse (zarar) mutlak değere göre hesaplanır — aksi halde
   * zarardan kâra geçiş negatif yüzde gösterirdi.
   */
  private pctChange(previous: Decimal, current: Decimal): number {
    if (previous.isZero()) return current.greaterThan(0) ? 100 : 0;

    const change = current
      .minus(previous)
      .div(previous.abs())
      .mul(100)
      .toDecimalPlaces(2);

    return change.toNumber();
  }

  private toSection(
    section: IncomeStatementSection
  ): IncomeStatementReportSection {
    return {
      total: section.total.toFixed(2),
      lines: section.lines.map((line) => ({
        code: line.code,
        name: line.name,
        amount: line.amount.toFixed(2),
      })),
    };
  }
}
