/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prisma } from '@prisma/client';
import { Account } from '@shared';
import { GetYearEndClosingPreviewHandler } from './get-year-end-closing-preview.handler';
import { GetYearEndClosingPreviewQuery } from './get-year-end-closing-preview.query';
import { GetAccountingPeriodByIdQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-period-by-id/get-accounting-period-by-id.query';
import { GetAccountingPeriodsQuery } from '@modules/finance/accounting/periods/application/queries/get-accounting-periods/get-accounting-periods.query';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetUnpostedFinancialEventsQuery } from '@modules/finance/accounting/financial-events/application/queries/get-unposted-financial-events/get-unposted-financial-events.query';
import { GetClinicFinanceSettingsQuery } from '@modules/organization/clinic/application/queries/get-clinic-finance-settings/get-clinic-finance-settings.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import { GetGrniAccrualCandidatesQuery } from '@modules/supply/purchasing/application/queries/get-grni-accrual-candidates/get-grni-accrual-candidates.query';
import type { GrniAccrualCandidate } from '@shared/modules/accounting-period/interfaces';

/**
 * Önizleme KAPANIŞIN GÖLGESİDİR: aynı planlayıcı, aynı aday hesabı. Hiçbir şey yazmaz;
 * kapanışı durduran her koşulu FIRLATMAZ, `blockers` olarak listeler (kapanış komutu aynı
 * koşulları fırlatır).
 */
describe('GetYearEndClosingPreviewHandler', () => {
  const CLINIC = 'clinic-1';
  const PERIOD_ID = 'period-2026';
  const ENDS_AT = new Date('2026-12-31T20:59:59.999Z');
  const STARTS_AT = new Date('2025-12-31T21:00:00.000Z');

  const account = (id: string, code: string): Account =>
    ({
      id,
      code,
      name: `Hesap ${code}`,
      isActive: true,
      isPostable: true,
    }) as unknown as Account;

  const CHART = [
    account('a-600', '600'),
    account('a-770', '770'),
    account('a-771', '771'),
    account('a-632', '632'),
    account('a-150', '150'),
    account('a-329', '329'),
    account('a-690', '690'),
    account('a-590', '590'),
    account('a-591', '591'),
    account('a-570', '570'),
    account('a-580', '580'),
    account('a-500', '500'),
  ];

  const row = (accountId: string, debit: number, credit: number) => ({
    accountId,
    totalDebit: new Prisma.Decimal(debit),
    totalCredit: new Prisma.Decimal(credit),
  });

  const candidate = (
    overrides: Partial<GrniAccrualCandidate> = {}
  ): GrniAccrualCandidate => ({
    orderId: 'o1',
    supplierId: 's1',
    orderDate: new Date('2026-10-01'),
    currency: 'TRY',
    receivedNet: '1000.00',
    invoicedNet: '600.00',
    accrualAmount: '400.00',
    accruable: true,
    notAccruableReason: null,
    suggestedDebitAccountCode: '150',
    includesLegacyReceipts: false,
    ...overrides,
  });

  interface Options {
    status?: 'OPEN' | 'LOCKED' | 'CLOSED';
    endsAt?: Date;
    otherPeriods?: { year: number; status: string }[];
    rows?: ReturnType<typeof row>[];
    chart?: Account[];
    candidates?: GrniAccrualCandidate[];
    invoicedNotReceived?: unknown[];
    unposted?: number;
    /** 2027 dönemi hiç açılmamış (GRNI ters kaydı yazılamaz). */
    withoutNextPeriod?: boolean;
    nextStatus?: string;
    /** Kliniğin işletme biçimi; verilmezse seçilmemiş (eski klinik). */
    businessType?: 'COMPANY' | 'SOLE_PROPRIETOR';
  }

  const build = (options: Options = {}) => {
    const period = {
      id: PERIOD_ID,
      clinicId: CLINIC,
      organizationId: 'org-1',
      year: 2026,
      status: options.status ?? 'OPEN',
      startsAt: STARTS_AT,
      endsAt: options.endsAt ?? ENDS_AT,
      lastEntryNo: 42n,
    };
    const periods = [
      { ...period },
      ...(options.withoutNextPeriod
        ? []
        : [
            {
              year: 2027,
              status: options.nextStatus ?? 'OPEN',
              startsAt: new Date('2026-12-31T21:00:00.000Z'),
            },
          ]),
      ...(options.otherPeriods ?? []),
    ];

    const trialBalance = jest
      .fn()
      .mockResolvedValue(
        options.rows ?? [row('a-600', 0, 1000), row('a-770', 400, 0)]
      );

    const queryBus = {
      execute: jest.fn((q: unknown) => {
        if (q instanceof GetAccountingPeriodByIdQuery)
          return Promise.resolve({ data: period });
        if (q instanceof GetAccountingPeriodsQuery)
          return Promise.resolve({ data: periods });
        if (q instanceof GetChartOfAccountsQuery)
          return Promise.resolve({ data: options.chart ?? CHART });
        if (q instanceof GetClinicCurrencyQuery)
          return Promise.resolve({ data: 'TRY' });
        if (q instanceof GetClinicFinanceSettingsQuery)
          return Promise.resolve({
            data: options.businessType
              ? { businessType: options.businessType }
              : null,
          });
        if (q instanceof GetGrniAccrualCandidatesQuery)
          return Promise.resolve({
            data: {
              clinicId: CLINIC,
              asOf: period.endsAt,
              candidates: options.candidates ?? [],
              invoicedNotReceived: options.invoicedNotReceived ?? [],
            },
          });
        if (q instanceof GetUnpostedFinancialEventsQuery)
          return Promise.resolve({
            data: [],
            meta: { pagination: { total: options.unposted ?? 0 } },
          });
        throw new Error('beklenmeyen sorgu');
      }),
    };

    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
        policy: { getSerializationOptions: () => ({}) },
      }),
    } as never;

    return {
      handler: new GetYearEndClosingPreviewHandler(
        { trialBalance } as never,
        policyFactory,
        queryBus as never
      ),
      trialBalance,
      queryBus,
    };
  };

  const run = (
    handler: GetYearEndClosingPreviewHandler,
    grniAccruals: { orderId: string; debitAccountCode: '150' | '770' }[] = []
  ) =>
    handler.execute(
      new GetYearEndClosingPreviewQuery({
        periodId: PERIOD_ID,
        filter: { grniAccruals },
        ctx: { actor: { userId: 'u-1' }, source: undefined } as never,
      })
    );

  it('blokajsız dönem: adımlar, özet ve yevmiye sayacı döner', async () => {
    const { handler } = build();
    const { data } = await run(handler);

    expect(data.canClose).toBe(true);
    expect(data.blockers).toEqual([]);
    expect(data.year).toBe(2026);
    // Kapanış bu değeri geri ister.
    expect(data.expectedLastEntryNo).toBe('42');
    expect(data.steps.map((s) => s.step)).toEqual([
      'COST_REFLECTION',
      'COST_REFLECTION_CLOSE',
      'CLOSE_TO_RESULT',
      'RESULT_TRANSFER',
    ]);
    expect(data.summary).toMatchObject({
      incomeTotal: '1000.00',
      expenseTotal: '400.00',
      netResult: '600.00',
      resultAccountCode: '590',
      reflectedCostTotal: '400.00',
      grniAccrualTotal: '0.00',
    });
  });

  it('satırlar hesap adını taşır ve her adımın borç toplamı döner', async () => {
    const { handler } = build();
    const { data } = await run(handler);

    const transfer = data.steps.find((s) => s.step === 'RESULT_TRANSFER')!;
    expect(transfer.totalDebit).toBe('600.00');
    expect(transfer.lines).toEqual([
      {
        accountCode: '690',
        accountName: 'Hesap 690',
        debit: '600.00',
        credit: '0.00',
        lineDesc: expect.any(String),
      },
      {
        accountCode: '590',
        accountName: 'Hesap 590',
        debit: '0.00',
        credit: '600.00',
        lineDesc: expect.any(String),
      },
    ]);
  });

  it('hiçbir şey yazmaz: yalnız okuma sorguları ve mizan okuması', async () => {
    const { handler, trialBalance, queryBus } = build();
    await run(handler);

    expect(trialBalance).toHaveBeenCalledWith({
      clinicId: CLINIC,
      dateFrom: STARTS_AT,
      dateTo: ENDS_AT,
    });
    // Sorgu sınıfları dışında hiçbir komut dispatch edilmez.
    for (const [q] of queryBus.execute.mock.calls) {
      expect(String((q as object).constructor.name)).toMatch(/Query$/);
    }
  });

  describe('blokajlar (fırlatmaz, listeler)', () => {
    it('dönem zaten kapalı', async () => {
      const { handler } = build({ status: 'CLOSED' });
      const { data } = await run(handler);

      expect(data.canClose).toBe(false);
      expect(data.blockers.map((b) => b.code)).toContain(
        'PERIOD_ALREADY_CLOSED'
      );
    });

    it('önceki yıl kapanmamış', async () => {
      const { handler } = build({
        otherPeriods: [{ year: 2025, status: 'OPEN' }],
      });
      const { data } = await run(handler);

      const blocker = data.blockers.find(
        (b) => b.code === 'PREVIOUS_PERIOD_NOT_CLOSED'
      )!;
      expect(blocker.meta).toMatchObject({ year: 2026, blockingYear: 2025 });
    });

    it('kapalı önceki yıl blokaj değildir', async () => {
      const { handler } = build({
        otherPeriods: [{ year: 2025, status: 'CLOSED' }],
      });
      const { data } = await run(handler);

      expect(data.blockers).toEqual([]);
    });

    it('fişlenmemiş ekonomik olay', async () => {
      const { handler } = build({ unposted: 3 });
      const { data } = await run(handler);

      const blocker = data.blockers.find((b) => b.code === 'UNPOSTED_EVENTS')!;
      expect(blocker.meta).toEqual({ unpostedCount: 3 });
    });

    it('eşlemesiz 7xx hesap: blokaj + boş plan (önizleme patlamaz)', async () => {
      const { handler } = build({
        chart: [...CHART, account('a-750', '750')],
        rows: [row('a-600', 0, 1000), row('a-750', 100, 0)],
      });
      const { data } = await run(handler);

      expect(data.blockers.map((b) => b.code)).toContain(
        'UNMAPPED_COST_ACCOUNT'
      );
      expect(data.steps).toEqual([]);
    });

    it('plan hesap planında olmayan hesap yazacaksa eksiklerin TAMAMI listelenir', async () => {
      const { handler } = build({
        chart: CHART.filter((a) => !['771', '632'].includes(a.code)),
      });
      const { data } = await run(handler);

      const blocker = data.blockers.find((b) => b.code === 'ACCOUNTS_MISSING')!;
      expect(blocker.meta).toEqual({
        clinicId: CLINIC,
        missingCodes: ['632', '771'],
      });
      // Adsız hesap sessizce gizlenmez: satırda işaretli kalır.
      const names = data.steps.flatMap((s) =>
        s.lines.map((l) => l.accountName)
      );
      expect(names).toContain('(hesap planında yok)');
    });
  });

  describe('GRNI', () => {
    it('aday listesi her zaman döner (UI seçim yapabilsin); seçilmeyen adaylar uyarıdır', async () => {
      const { handler } = build({
        candidates: [
          candidate({ orderId: 'o1' }),
          candidate({ orderId: 'o2' }),
        ],
      });
      const { data } = await run(handler);

      expect(data.grniCandidates.map((c) => c.orderId)).toEqual(['o1', 'o2']);
      expect(data.warnings.unselectedGrniOrderIds).toEqual(['o1', 'o2']);
      expect(data.steps.some((s) => s.step === 'GRNI_ACCRUAL')).toBe(false);
    });

    it('seçilen aday planlara girer: tahakkuk + ters kayıt, tutar adaydan', async () => {
      const { handler } = build({ candidates: [candidate()] });
      const { data } = await run(handler, [
        { orderId: 'o1', debitAccountCode: '150' },
      ]);

      expect(data.blockers).toEqual([]);
      const accrual = data.steps.find((s) => s.step === 'GRNI_ACCRUAL')!;
      expect(accrual.totalDebit).toBe('400.00');
      expect(data.summary.grniAccrualTotal).toBe('400.00');
      expect(data.steps.find((s) => s.step === 'GRNI_REVERSAL')?.period).toBe(
        'NEXT_PERIOD'
      );
      expect(data.warnings.unselectedGrniOrderIds).toEqual([]);
    });

    it('aday olmayan sipariş seçimi blokajdır; önizleme tahakkuksuz plan gösterir', async () => {
      const { handler } = build({ candidates: [candidate()] });
      const { data } = await run(handler, [
        { orderId: 'yok', debitAccountCode: '150' },
      ]);

      expect(data.blockers.map((b) => b.code)).toContain(
        'GRNI_SELECTION_INVALID'
      );
      expect(data.steps.some((s) => s.step === 'GRNI_ACCRUAL')).toBe(false);
      expect(data.canClose).toBe(false);
    });

    it('yabancı para birimli aday seçilemez', async () => {
      const { handler } = build({
        candidates: [
          candidate({
            currency: 'EUR',
            accruable: false,
            notAccruableReason: 'FOREIGN_CURRENCY',
          }),
        ],
      });
      const { data } = await run(handler, [
        { orderId: 'o1', debitAccountCode: '150' },
      ]);

      expect(data.blockers[0]).toMatchObject({
        code: 'GRNI_SELECTION_INVALID',
        meta: { orderId: 'o1', reason: 'FOREIGN_CURRENCY' },
      });
      // Tahakkuk edilemez adaylar "seçilmemiş" uyarısına girmez.
      expect(data.warnings.unselectedGrniOrderIds).toEqual([]);
    });

    it('tahakkuk seçildi ama ertesi yıl dönemi yok → blokaj, tahakkuksuz plan', async () => {
      const { handler } = build({
        candidates: [candidate()],
        withoutNextPeriod: true,
      });

      const { data } = await run(handler, [
        { orderId: 'o1', debitAccountCode: '150' },
      ]);

      const blocker = data.blockers.find(
        (b) => b.code === 'NEXT_PERIOD_UNAVAILABLE'
      )!;
      expect(blocker.meta).toMatchObject({ nextYear: 2027, reason: 'MISSING' });
      expect(data.steps.some((s) => s.step === 'GRNI_ACCRUAL')).toBe(false);
    });

    it('ertesi yıl dönemi açık değilse (CLOSED) ters kayıt yazılamaz → blokaj', async () => {
      const { handler } = build({
        candidates: [candidate()],
        nextStatus: 'CLOSED',
      });

      const { data } = await run(handler, [
        { orderId: 'o1', debitAccountCode: '150' },
      ]);

      expect(
        data.blockers.find((b) => b.code === 'NEXT_PERIOD_UNAVAILABLE')?.meta
      ).toMatchObject({ reason: 'NOT_OPEN' });
    });

    it('tahakkuk seçilmedi + işletme biçimi yok → ertesi yıl dönemi yokluğu blokaj DEĞİLDİR', async () => {
      const { handler } = build({ withoutNextPeriod: true });

      const { data } = await run(handler);

      expect(data.blockers).toEqual([]);
      expect(data.canClose).toBe(true);
    });

    it('faturası kabulünden fazla stok uyarıları olduğu gibi taşınır (K4)', async () => {
      const warning = {
        orderId: 'o9',
        supplierId: 's1',
        currency: 'TRY',
        invoicedNet: '500.00',
        receivedNet: '200.00',
        difference: '300.00',
      };
      const { handler } = build({ invoicedNotReceived: [warning] });
      const { data } = await run(handler);

      expect(data.warnings.invoicedNotReceived).toEqual([warning]);
      // Uyarıdır; blokaj değil, otomatik fiş de yok.
      expect(data.canClose).toBe(true);
    });
  });

  describe('uyarılar', () => {
    it('dönem sonu henüz gelmediyse periodNotEnded', async () => {
      const future = new Date(Date.now() + 90 * 24 * 3600 * 1000);
      const { handler } = build({ endsAt: future });
      const { data } = await run(handler);

      expect(data.warnings.periodNotEnded).toBe(true);
    });

    it('dönem bitmişse periodNotEnded false', async () => {
      const { handler } = build({
        endsAt: new Date('2025-12-31T20:59:59.999Z'),
      });
      const { data } = await run(handler);

      expect(data.warnings.periodNotEnded).toBe(false);
    });
  });

  describe('işletme biçimi ve öz kaynak devri', () => {
    it('şirket: devir adımı ertesi yılın 1 Ocak’ında B 590 / A 570', async () => {
      const { handler } = build({ businessType: 'COMPANY' });

      const { data } = await run(handler);

      const step = data.steps.find((s) => s.step === 'EQUITY_CARRYFORWARD')!;
      expect(step.period).toBe('NEXT_PERIOD');
      expect(step.lines.map((l) => [l.accountCode, l.debit, l.credit])).toEqual(
        [
          ['590', '600.00', '0.00'],
          ['570', '0.00', '600.00'],
        ]
      );
      expect(data.warnings.businessTypeMissing).toBe(false);
      expect(data.canClose).toBe(true);
    });

    it('şahıs: devir sermayeye (500) yapılır', async () => {
      const { handler } = build({ businessType: 'SOLE_PROPRIETOR' });

      const { data } = await run(handler);

      const step = data.steps.find((s) => s.step === 'EQUITY_CARRYFORWARD')!;
      expect(step.lines.map((l) => l.accountCode)).toEqual(['590', '500']);
    });

    it('biçim seçilmemiş: devir adımı yok, uyarı var, kapanış engellenmez', async () => {
      const { handler } = build();

      const { data } = await run(handler);

      expect(data.steps.some((s) => s.step === 'EQUITY_CARRYFORWARD')).toBe(
        false
      );
      expect(data.warnings.businessTypeMissing).toBe(true);
      expect(data.canClose).toBe(true);
    });

    it('biçim seçili ama ertesi yıl dönemi yok → blokaj; plan devirsiz kurulur (patlamaz)', async () => {
      const { handler } = build({
        businessType: 'COMPANY',
        withoutNextPeriod: true,
      });

      const { data } = await run(handler);

      expect(
        data.blockers.find((b) => b.code === 'NEXT_PERIOD_UNAVAILABLE')?.meta
      ).toMatchObject({ nextYear: 2027, reason: 'MISSING' });
      expect(data.steps.some((s) => s.step === 'EQUITY_CARRYFORWARD')).toBe(
        false
      );
      expect(data.canClose).toBe(false);
    });

    it('hesap planında hedef hesap (570) yoksa ACCOUNTS_MISSING blokajı', async () => {
      const { handler } = build({
        businessType: 'COMPANY',
        chart: CHART.filter((a) => a.code !== '570'),
      });

      const { data } = await run(handler);

      expect(
        data.blockers.find((b) => b.code === 'ACCOUNTS_MISSING')?.meta
      ).toMatchObject({ missingCodes: ['570'] });
    });
  });
});
