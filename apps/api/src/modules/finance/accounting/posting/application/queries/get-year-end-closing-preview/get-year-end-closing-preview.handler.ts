import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Decimal } from 'decimal.js';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { PaginationSchema } from '@shared/common/pagination/pagination.schema';
import type {
  GrniAccrualCandidate,
  YearEndClosingBlocker,
  YearEndClosingPreview,
  YearEndClosingStep,
} from '@shared/modules/accounting-period/interfaces';
import { AccountingPeriodStatusSchema, Account } from '@shared';
import { GetAccountingPeriodByIdQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-period-by-id/get-accounting-period-by-id.query';
import { GetAccountingPeriodsQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-periods/get-accounting-periods.query';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetUnpostedFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-unposted-financial-events/get-unposted-financial-events.query';
import { GetClinicFinanceSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-finance-settings/get-clinic-finance-settings.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import { GetGrniAccrualCandidatesQuery } from '@modules/supply/purchasing/application/queries/get-grni-accrual-candidates/get-grni-accrual-candidates.query';
import {
  IJournalQueryRepository,
  JOURNAL_QUERY_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { POSTABLE_FINANCIAL_EVENT_TYPES } from '@modules/finance/accounting/posting/domain/posting/postable-event-types.constant';
import { YearEndClosingService } from '@modules/finance/accounting/posting/domain/services/year-and-closing.service';
import {
  ClosingAccrual,
  ClosingBusinessType,
  YearEndClosingPlan,
  collectPlanAccountCodes,
  planYearEndClosing,
} from '@modules/finance/accounting/posting/domain/closing/year-end-closing.planner';
import { resolveGrniAccruals } from '@modules/finance/accounting/posting/domain/closing/grni-accrual-selection.resolver';
import {
  GrniAccrualNotEligibleException,
  UnmappedCostAccountException,
} from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { GetYearEndClosingPreviewQuery } from './get-year-end-closing-preview.query';
import { GetYearEndClosingPreviewResponse } from './get-year-end-closing-preview.response';

const money = (value: Decimal): string => value.toFixed(2);

@QueryHandler(GetYearEndClosingPreviewQuery)
export class GetYearEndClosingPreviewHandler implements IQueryHandler<
  GetYearEndClosingPreviewQuery,
  GetYearEndClosingPreviewResponse
> {
  constructor(
    @Inject(JOURNAL_QUERY_REPOSITORY)
    private readonly journalQueryRepo: IJournalQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly queryBus: TSQueryBus
  ) {}

  async execute(
    query: GetYearEndClosingPreviewQuery
  ): Promise<GetYearEndClosingPreviewResponse> {
    const { periodId, filter, ctx } = query.payload;

    // Dönem, kimliğinden dönem modülünün bus'ından çözülür (kapsam kontrolü orada da var).
    const { data: period } = await this.queryBus.execute(
      new GetAccountingPeriodByIdQuery(periodId, ctx)
    );
    const clinicId = period.clinicId;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow(ACCOUNTING_EVENTS.PERIOD_CLOSE);

    const [
      { data: periods },
      { data: accounts },
      { data: functionalCurrency },
      { data: financeSettings },
    ] = await Promise.all([
      this.queryBus.execute(new GetAccountingPeriodsQuery(clinicId, ctx)),
      this.queryBus.execute(new GetChartOfAccountsQuery(clinicId, ctx)),
      this.queryBus.execute(new GetClinicCurrencyQuery(clinicId)),
      this.queryBus.execute(new GetClinicFinanceSettingsQuery(clinicId)),
    ]);
    const businessType = financeSettings?.businessType ?? null;

    const rows = await this.journalQueryRepo.trialBalance({
      clinicId,
      dateFrom: period.startsAt,
      dateTo: period.endsAt,
    });

    const { data: grni } = await this.queryBus.execute(
      new GetGrniAccrualCandidatesQuery({
        clinicId,
        asOf: period.endsAt,
        functionalCurrency,
        ctx,
      })
    );

    const blockers: YearEndClosingBlocker[] = [];

    if (period.status === AccountingPeriodStatusSchema.enum.CLOSED) {
      blockers.push({
        code: 'PERIOD_ALREADY_CLOSED',
        message: `${period.year} dönemi zaten kapatılmış.`,
        meta: { periodId, year: period.year },
      });
    }

    const oldestOpen = periods
      .filter(
        (p) =>
          p.year < period.year &&
          p.status !== AccountingPeriodStatusSchema.enum.CLOSED
      )
      .sort((a, b) => a.year - b.year)[0];
    if (oldestOpen) {
      blockers.push({
        code: 'PREVIOUS_PERIOD_NOT_CLOSED',
        message: `Önce ${oldestOpen.year} yılı kapatılmalıdır.`,
        meta: { periodId, year: period.year, blockingYear: oldestOpen.year },
      });
    }

    const unposted = await this.countUnpostedEvents({
      clinicId,
      from: period.startsAt,
      to: period.endsAt,
      query,
    });
    if (unposted > 0) {
      blockers.push({
        code: 'UNPOSTED_EVENTS',
        message: `${unposted} ekonomik olay henüz fişlenmedi.`,
        meta: { unpostedCount: unposted },
      });
    }

    // Seçim: sunucunun hesapladığı aday listesine bağlanır; geçersiz seçim blokajdır, önizleme
    // yine de tahakkuksuz planla üretilir ki muhasebeci geri kalanı görebilsin.
    let accruals: ClosingAccrual[] = [];
    if (filter.grniAccruals.length > 0) {
      try {
        accruals = resolveGrniAccruals({
          candidates: grni.candidates,
          selections: filter.grniAccruals,
        });
      } catch (error) {
        if (!(error instanceof GrniAccrualNotEligibleException)) throw error;
        blockers.push({
          code: 'GRNI_SELECTION_INVALID',
          message: error.message,
          meta: error.meta ?? {},
        });
      }
    }

    // Ertesi yıla fiş yazılacaksa (GRNI ters kaydı, öz kaynak devri) o yılın dönemi var ve OPEN olmalı.
    const nextPeriod = periods.find((p) => p.year === period.year + 1) ?? null;
    let planBusinessType = businessType;
    if (accruals.length > 0 || businessType !== null) {
      const reason = !nextPeriod
        ? 'MISSING'
        : nextPeriod.status !== AccountingPeriodStatusSchema.enum.OPEN
          ? 'NOT_OPEN'
          : null;
      if (reason) {
        blockers.push({
          code: 'NEXT_PERIOD_UNAVAILABLE',
          message:
            reason === 'MISSING'
              ? `${period.year + 1} dönemi açılmamış; ters kayıt ve öz kaynak devri yazılamaz.`
              : `${period.year + 1} dönemi açık değil; ters kayıt ve öz kaynak devri yazılamaz.`,
          meta: { periodId, nextYear: period.year + 1, reason },
        });
        accruals = [];
        planBusinessType = null;
      }
    }

    const plan = this.safePlan({
      query,
      rows,
      accounts,
      periodEndsAt: period.endsAt,
      nextPeriodStartsAt: nextPeriod?.startsAt ?? null,
      accruals,
      businessType: planBusinessType,
      blockers,
    });

    const chartCodes = new Set(accounts.map((a) => a.code));
    const missingCodes = collectPlanAccountCodes(plan).filter(
      (code) => !chartCodes.has(code)
    );
    if (missingCodes.length > 0) {
      blockers.push({
        code: 'ACCOUNTS_MISSING',
        message: `Hesap planında eksik hesap(lar): ${missingCodes.join(', ')}. Hesap planı kurulumunu yeniden çalıştırın.`,
        meta: { clinicId, missingCodes },
      });
    }

    const selectedIds = new Set(filter.grniAccruals.map((s) => s.orderId));
    const preview: YearEndClosingPreview = {
      periodId,
      clinicId,
      year: period.year,
      periodStatus: period.status,
      startsAt: period.startsAt,
      endsAt: period.endsAt,
      expectedLastEntryNo: period.lastEntryNo.toString(),
      summary: {
        incomeTotal: money(plan.incomeTotal),
        expenseTotal: money(plan.expenseTotal),
        netResult: money(plan.netResult),
        resultAccountCode: plan.resultAccountCode,
        reflectedCostTotal: money(plan.reflectedCostTotal),
        grniAccrualTotal: money(plan.grniAccrualTotal),
      },
      steps: this.toSteps(plan, accounts),
      grniCandidates: grni.candidates,
      blockers,
      warnings: {
        periodNotEnded: DateTimeManager.isBefore(
          DateTimeManager.create(),
          period.endsAt
        ),
        businessTypeMissing: businessType === null,
        invoicedNotReceived: grni.invoicedNotReceived,
        unselectedGrniOrderIds: grni.candidates
          .filter(
            (candidate: GrniAccrualCandidate) =>
              candidate.accruable && !selectedIds.has(candidate.orderId)
          )
          .map((candidate) => candidate.orderId),
      },
      canClose: blockers.length === 0,
    };

    return {
      data: preview,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }

  /**
   * Plan kurulamıyorsa (eşlemesiz 7xx hesap) blokaj eklenir ve boş plan döner; önizleme patlayıp
   * muhasebeciyi kör bırakmaz. Kapanış komutu aynı hatayı FIRLATIR — blokajın karşılığı odur.
   */
  private safePlan(props: {
    query: GetYearEndClosingPreviewQuery;
    rows: Awaited<ReturnType<IJournalQueryRepository['trialBalance']>>;
    accounts: Account[];
    periodEndsAt: Date;
    nextPeriodStartsAt: Date | null;
    accruals: ClosingAccrual[];
    businessType: ClosingBusinessType | null;
    blockers: YearEndClosingBlocker[];
  }): YearEndClosingPlan {
    try {
      return planYearEndClosing({
        balances: YearEndClosingService.toClosingBalances({
          trialBalanceRows: props.rows,
          accounts: props.accounts,
        }),
        periodEndsAt: props.periodEndsAt,
        nextPeriodStartsAt: props.nextPeriodStartsAt,
        accruals: props.accruals,
        businessType: props.businessType,
      });
    } catch (error) {
      if (!(error instanceof UnmappedCostAccountException)) throw error;
      props.blockers.push({
        code: 'UNMAPPED_COST_ACCOUNT',
        message: error.message,
        meta: error.meta ?? {},
      });
      return {
        steps: [],
        incomeTotal: new Decimal(0),
        expenseTotal: new Decimal(0),
        netResult: new Decimal(0),
        resultAccountCode: null,
        reflectedCostTotal: new Decimal(0),
        grniAccrualTotal: new Decimal(0),
      };
    }
  }

  private toSteps(
    plan: YearEndClosingPlan,
    accounts: Account[]
  ): YearEndClosingStep[] {
    const nameByCode = new Map(accounts.map((a) => [a.code, a.name]));

    return plan.steps.map((step) => ({
      step: step.step,
      entryKind: step.entryKind,
      period: step.period,
      entryDate: step.entryDate,
      description: step.description,
      // Hesap planında olmayan kod adsız gösterilir ve ayrıca ACCOUNTS_MISSING blokajı üretir.
      lines: step.lines.map((line) => ({
        accountCode: line.accountCode,
        accountName: nameByCode.get(line.accountCode) ?? '(hesap planında yok)',
        debit: money(line.debit),
        credit: money(line.credit),
        lineDesc: line.lineDesc,
      })),
      totalDebit: money(
        step.lines.reduce((sum, line) => sum.plus(line.debit), new Decimal(0))
      ),
    }));
  }

  /** Fişlenmemiş olay sayısı: yalnız toplam gerekir, ilk sayfa yeter. */
  private async countUnpostedEvents(props: {
    clinicId: string;
    from: Date;
    to: Date;
    query: GetYearEndClosingPreviewQuery;
  }): Promise<number> {
    const { meta } = await this.queryBus.execute(
      new GetUnpostedFinancialEventsQuery({
        filter: {
          clinicId: props.clinicId,
          from: props.from,
          to: props.to,
          types: POSTABLE_FINANCIAL_EVENT_TYPES,
        },
        pagination: PaginationSchema.parse({ limit: 1, page: 1 }),
        ctx: props.query.payload.ctx,
      })
    );
    return meta?.pagination?.total ?? 0;
  }
}
