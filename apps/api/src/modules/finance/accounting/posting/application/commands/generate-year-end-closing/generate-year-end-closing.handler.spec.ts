import { Prisma } from '@prisma/client';
import { Account } from '@shared';
import { GenerateYearEndClosingHandler } from './generate-year-end-closing.handler';
import { GenerateYearEndClosingCommand } from './generate-year-end-closing.command';
import { GetChartOfAccountsQuery } from '@modules/finance/accounting/chart-of-accounts/application/queries/get-chart-of-accounts/get-chart-of-accounts.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import { GetGrniAccrualCandidatesQuery } from '@modules/supply/purchasing/application/queries/get-grni-accrual-candidates/get-grni-accrual-candidates.query';
import {
  ClosingAccountsMissingException,
  GrniAccrualNotEligibleException,
} from '@modules/finance/accounting/posting/domain/exceptions/year-end-closing.exceptions';
import { JournalEntry } from '@modules/finance/accounting/posting/domain/entities/journal-entry.entity';

/**
 * Yıl sonu kapanışının YAZMA tarafı: plan fişe çevrilir, numaralar doğru akıştan alınır ve
 * tek transaction içinde yazılır. Hesaplama planlayıcıda (`year-end-closing.planner.spec.ts`);
 * burada orkestrasyon kilitlenir.
 */
describe('GenerateYearEndClosingHandler', () => {
  const CLINIC = 'clinic-1';
  const ENDS_AT = new Date('2026-12-31T20:59:59.999Z');
  const NEXT_STARTS = new Date('2026-12-31T21:00:00.000Z');

  const account = (id: string, code: string): Account =>
    ({
      id,
      code,
      name: code,
      isActive: true,
      isPostable: true,
    }) as unknown as Account;

  const FULL_CHART = [
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
    account('a-500', '500'),
  ];

  const row = (accountId: string, debit: number, credit: number) => ({
    accountId,
    totalDebit: new Prisma.Decimal(debit),
    totalCredit: new Prisma.Decimal(credit),
  });

  const command = (
    overrides: Partial<GenerateYearEndClosingCommand['input']> = {}
  ) =>
    new GenerateYearEndClosingCommand(
      {
        clinicId: CLINIC,
        organizationId: 'org-1',
        periodId: 'period-2026',
        dateFrom: new Date('2025-12-31T21:00:00.000Z'),
        dateTo: ENDS_AT,
        entryDate: ENDS_AT,
        performedById: 'u-1',
        nextPeriod: null,
        grniAccruals: [],
        businessType: null,
        ...overrides,
      },
      { actor: { userId: 'u-1' }, source: undefined } as never
    );

  const build = (
    options: {
      chart?: Account[];
      rows?: ReturnType<typeof row>[];
      candidates?: unknown[];
      accessOk?: boolean;
    } = {}
  ) => {
    const chart = options.chart ?? FULL_CHART;
    const rows = options.rows ?? [row('a-600', 0, 1000), row('a-770', 400, 0)];

    const created: JournalEntry[] = [];
    const journalCommandRepo = {
      trialBalance: jest.fn().mockResolvedValue(rows),
      create: jest.fn((entry: JournalEntry) => {
        created.push(entry);
        return Promise.resolve(entry);
      }),
    };

    const closingNos: string[] = [];
    let counter = 100n;
    const entryNumbering = {
      lockAndAllocateClosingEntryNo: jest.fn((periodId: string) => {
        closingNos.push(`closing:${periodId}`);
        counter += 1n;
        return Promise.resolve(counter);
      }),
      lockAndAllocateEntryNo: jest.fn((periodId: string) => {
        closingNos.push(`regular:${periodId}`);
        counter += 1n;
        return Promise.resolve(counter);
      }),
    };

    const queryBus = {
      execute: jest.fn((q: unknown) => {
        if (q instanceof GetChartOfAccountsQuery)
          return Promise.resolve({ data: chart });
        if (q instanceof GetClinicCurrencyQuery)
          return Promise.resolve({ data: 'TRY' });
        if (q instanceof GetGrniAccrualCandidatesQuery) {
          return Promise.resolve({
            data: {
              clinicId: CLINIC,
              asOf: ENDS_AT,
              candidates: options.candidates ?? [],
              invoicedNotReceived: [],
            },
          });
        }
        throw new Error('beklenmeyen sorgu');
      }),
    };

    const orThrow = jest.fn(() => {
      if (options.accessOk === false) throw new Error('forbidden');
    });
    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: { check: jest.fn().mockReturnValue({ orThrow }) },
      }),
    } as never;

    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as never;

    return {
      handler: new GenerateYearEndClosingHandler(
        journalCommandRepo as never,
        policyFactory,
        entryNumbering as never,
        queryBus as never,
        txManager
      ),
      journalCommandRepo,
      entryNumbering,
      closingNos,
      created,
      queryBus,
    };
  };

  it('mizanı Command Repo’dan okur; fişleri sırayla mühürler ve yazar', async () => {
    const { handler, journalCommandRepo, created, entryNumbering } = build();

    await handler.execute(command());

    expect(journalCommandRepo.trialBalance).toHaveBeenCalledTimes(1);
    expect(created.map((e) => e.toPersistence().description)).toEqual([
      'Hizmet üretim ve gider hesaplarının yansıtılması (7 → 6)',
      'Yansıtma hesaplarının kapatılması (7)',
      'Gelir/gider hesaplarının kapanışı (→690)',
      'Dönem K/Z devri (690 → 590/591)',
    ]);
    // Her fişe sıra numarası verilir ve POSTED yazılır.
    expect(created.every((e) => e.isPosted())).toBe(true);
    expect(created.map((e) => e.entryNo?.value)).toEqual([
      '101',
      '102',
      '103',
      '104',
    ]);
    expect(entryNumbering.lockAndAllocateClosingEntryNo).toHaveBeenCalledTimes(
      4
    );
    expect(entryNumbering.lockAndAllocateEntryNo).not.toHaveBeenCalled();
  });

  it('kapanış numaraları kapanış varyantından alınır (dönem bu tx’te zaten CLOSED)', async () => {
    const { handler, closingNos } = build();
    await handler.execute(command());

    expect(closingNos.every((n) => n === 'closing:period-2026')).toBe(true);
  });

  it('hareket yoksa hiç numara tahsis edilmez ve fiş yazılmaz', async () => {
    const { handler, created, entryNumbering } = build({
      rows: [row('a-600', 1000, 1000)],
    });

    await handler.execute(command());

    expect(created).toEqual([]);
    expect(entryNumbering.lockAndAllocateClosingEntryNo).not.toHaveBeenCalled();
  });

  it('yetki yoksa hiçbir şey okunmaz ya da yazılmaz', async () => {
    const { handler, journalCommandRepo, queryBus } = build({
      accessOk: false,
    });

    await expect(handler.execute(command())).rejects.toThrow('forbidden');
    expect(queryBus.execute).not.toHaveBeenCalled();
    expect(journalCommandRepo.trialBalance).not.toHaveBeenCalled();
  });

  describe('hesap planı eksikleri', () => {
    it('kapanışın yazacağı hesapların TAMAMI baştan listelenir; hiçbir fiş yazılmaz', async () => {
      // 622 ve 632 şablona sonradan eklendi: mevcut kliniklerde yoktur. 770 → 632 + 741 hesapları eksik.
      const chart = FULL_CHART.filter((a) => !['771', '632'].includes(a.code));
      const { handler, created, entryNumbering } = build({ chart });

      const error = await handler.execute(command()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ClosingAccountsMissingException);
      expect((error as ClosingAccountsMissingException).meta).toEqual({
        clinicId: CLINIC,
        missingCodes: ['632', '771'],
      });
      expect(created).toEqual([]);
      expect(
        entryNumbering.lockAndAllocateClosingEntryNo
      ).not.toHaveBeenCalled();
    });
  });

  describe('GRNI tahakkuku', () => {
    const candidate = {
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
    };
    const nextPeriod = { id: 'period-2027', startsAt: NEXT_STARTS };
    const selection = [{ orderId: 'o1', debitAccountCode: '150' as const }];

    it('seçim yoksa satın alma modülüne HİÇ gidilmez', async () => {
      const { handler, queryBus } = build();
      await handler.execute(command());

      const asked = queryBus.execute.mock.calls.map(([q]) => q);
      expect(
        asked.some((q) => q instanceof GetGrniAccrualCandidatesQuery)
      ).toBe(false);
    });

    it('aday listesi dönem sonu (asOf) ve defter parasıyla sorulur', async () => {
      const { handler, queryBus } = build({ candidates: [candidate] });

      await handler.execute(command({ nextPeriod, grniAccruals: selection }));

      const q = queryBus.execute.mock.calls
        .map(([x]) => x)
        .find((x) => x instanceof GetGrniAccrualCandidatesQuery)!;
      expect(q.payload).toMatchObject({
        clinicId: CLINIC,
        asOf: ENDS_AT,
        functionalCurrency: 'TRY',
      });
    });

    it('tutar aday listesinden gelir; tahakkuk kapanan yılın, ters kayıt ertesi yılın numara akışına girer', async () => {
      const { handler, created, closingNos } = build({
        candidates: [candidate],
      });

      await handler.execute(command({ nextPeriod, grniAccruals: selection }));

      const accrual = created.find(
        (e) =>
          e.toPersistence().kind === 'ADJUSTING' &&
          e.toPersistence().periodId === 'period-2026'
      )!;
      const reversal = created.find(
        (e) => e.toPersistence().periodId === 'period-2027'
      )!;

      expect(accrual.totalDebit.toString()).toBe('400');
      expect(reversal.toPersistence().kind).toBe('ADJUSTING');
      expect(reversal.toPersistence().entryDate).toEqual(NEXT_STARTS);
      // Kilit sırası eski yıldan yeniye: ertesi yıl numarası EN SON alınır.
      expect(closingNos[closingNos.length - 1]).toBe('regular:period-2027');
      expect(
        closingNos.slice(0, -1).every((n) => n === 'closing:period-2026')
      ).toBe(true);
    });

    it('aday olmayan sipariş seçilemez (istemci tutar dayatamaz); hiçbir fiş yazılmaz', async () => {
      const { handler, created } = build({ candidates: [candidate] });

      const error = await handler
        .execute(
          command({
            nextPeriod,
            grniAccruals: [
              { orderId: 'baska-siparis', debitAccountCode: '150' },
            ],
          })
        )
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(GrniAccrualNotEligibleException);
      expect(created).toEqual([]);
    });

    it('yabancı para birimli aday tahakkuk edilemez', async () => {
      const { handler } = build({
        candidates: [
          {
            ...candidate,
            currency: 'EUR',
            accruable: false,
            notAccruableReason: 'FOREIGN_CURRENCY',
          },
        ],
      });

      const error = await handler
        .execute(command({ nextPeriod, grniAccruals: selection }))
        .catch((e: unknown) => e);

      expect((error as GrniAccrualNotEligibleException).meta).toEqual({
        orderId: 'o1',
        reason: 'FOREIGN_CURRENCY',
      });
    });
  });

  describe('öz kaynağa devir (işletme biçimi)', () => {
    const next = {
      id: 'period-2027',
      startsAt: new Date('2026-12-31T21:00:00.000Z'),
    };

    it('şirket: devir fişi ertesi yılın numara akışına, EN SON ve CLOSING olarak yazılır', async () => {
      const { handler, created, closingNos } = build();

      await handler.execute(
        command({ nextPeriod: next, businessType: 'COMPANY' })
      );

      const carry = created.find(
        (e) => e.toPersistence().periodId === 'period-2027'
      )!;
      const p = carry.toPersistence();
      expect(p.kind).toBe('CLOSING');
      expect(p.entryDate).toEqual(next.startsAt);
      expect(carry.totalDebit.toString()).toBe('600');
      expect(closingNos[closingNos.length - 1]).toBe('regular:period-2027');
      expect(
        closingNos.slice(0, -1).every((n) => n === 'closing:period-2026')
      ).toBe(true);
    });

    it('biçim yoksa ertesi yıla hiçbir fiş yazılmaz', async () => {
      const { handler, created } = build();

      await handler.execute(command({ nextPeriod: next, businessType: null }));

      expect(
        created.some((e) => e.toPersistence().periodId === 'period-2027')
      ).toBe(false);
    });

    it('hedef hesap (570) hesap planında yoksa hiçbir fiş yazılmaz', async () => {
      const { handler, created } = build({
        chart: FULL_CHART.filter((a) => a.code !== '570'),
      });

      await expect(
        handler.execute(command({ nextPeriod: next, businessType: 'COMPANY' }))
      ).rejects.toThrow();
      expect(created).toEqual([]);
    });
  });
});
