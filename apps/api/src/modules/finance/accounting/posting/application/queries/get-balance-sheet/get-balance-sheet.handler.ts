import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
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
  IncomeStatementSection,
} from '@modules/finance/accounting/posting/domain/reporting/income-statement.calculator';
import { BalanceSheetCalculator } from '@modules/finance/accounting/posting/domain/reporting/balance-sheet.calculator';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { normalizeReportDateRange } from '@modules/finance/shared/domain/reporting/report-date-range';
import { GetBalanceSheetQuery } from './get-balance-sheet.query';
import {
  BalanceSheetReportSection,
  GetBalanceSheetResponse,
} from './get-balance-sheet.response';

@QueryHandler(GetBalanceSheetQuery)
export class GetBalanceSheetHandler implements IQueryHandler<
  GetBalanceSheetQuery,
  GetBalanceSheetResponse
> {
  constructor(
    @Inject(JOURNAL_QUERY_REPOSITORY)
    private readonly journalQueryRepo: IJournalQueryRepository,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetBalanceSheetQuery): Promise<GetBalanceSheetResponse> {
    const { clinicId, ctx, asOf } = query.payload;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin bilançoya erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.BALANCE_SHEET);

    const serializationOptions = policy.getSerializationOptions({ clinicId });

    // Bilanço kümülatiftir: `dateFrom` YOK — bakiyeler defterin başından `asOf`
    // tarihine kadar birikir. Alt sınır konulsaydı varlık/kaynak hesaplarının o
    // tarihten önceki tüm hareketi (ve geçmiş yılların kârı) rapordan düşerdi.
    //
    // `kinds` de verilmez: kapanış fişi bilançoya AİTTİR — kârı öz kaynağa (590)
    // taşıyan kayıt odur. Kapanmış bir yılda 6/7 zaten sıfırlanmış olur, o yüzden
    // aşağıdaki `netProfit` doğru biçimde 0 çıkar ve kâr öz kaynak satırında
    // görünür. Kapanış dışlansaydı aynı kâr iki kez sayılırdı (hem 6/7 hem 590).
    const rows = await this.journalQueryRepo.trialBalance({
      clinicId,
      dateTo: asOf,
    });
    const { data: accounts } = await this.queryBus.execute(
      new GetChartOfAccountsQuery(clinicId, ctx)
    );

    const accountById = new Map<string, (typeof accounts)[number]>(
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

    // Dönem sonucu gelir tablosundan; bilançoyu dengeleyen öz kaynak kalemi.
    const { netProfit } = IncomeStatementCalculator.compute(balances);
    const r = BalanceSheetCalculator.compute(balances, netProfit);

    // Rapor başlığı gün sonuna genişletilmiş anı gösterir: "31 Aralık" isteği
    // 31 Aralık 23:59:59.999'u kapsar (repo aynı normalizasyonu uygular).
    const { dateTo: normalizedAsOf } = normalizeReportDateRange({
      dateTo: asOf,
    });

    return {
      data: {
        clinicId,
        asOf: normalizedAsOf ?? null,
        currentAssets: this.toSection(r.currentAssets),
        nonCurrentAssets: this.toSection(r.nonCurrentAssets),
        totalAssets: r.totalAssets.toFixed(2),
        shortTermLiabilities: this.toSection(r.shortTermLiabilities),
        longTermLiabilities: this.toSection(r.longTermLiabilities),
        equity: this.toSection(r.equity),
        periodResult: r.periodResult.toFixed(2),
        totalLiabilitiesAndEquity: r.totalLiabilitiesAndEquity.toFixed(2),
        isBalanced: r.isBalanced,
      },
      meta: { serializationOptions },
    };
  }

  private toSection(
    section: IncomeStatementSection
  ): BalanceSheetReportSection {
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
