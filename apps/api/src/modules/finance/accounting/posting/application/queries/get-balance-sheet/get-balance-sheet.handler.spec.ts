import { Decimal } from 'decimal.js';
import { GetBalanceSheetHandler } from './get-balance-sheet.handler';
import { GetBalanceSheetQuery } from './get-balance-sheet.query';
import {
  IJournalQueryRepository,
  TrialBalanceFilter,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';

/**
 * Bilanço bir **an** fotoğrafıdır, aralık toplamı değildir.
 *
 * Eskiden `dateFrom`/`dateTo` alıp mizana olduğu gibi geçiyordu. `dateFrom`
 * verildiğinde 100 Kasa'nın o tarihten önceki tüm hareketi, geçmiş yılların kârı
 * (590) ve açılış bakiyeleri **rapordan düşüyordu** — ama `isBalanced` yine `true`
 * diyordu: pencerenin içindeki her fiş kendi içinde dengeli olduğundan Aktif =
 * Pasif tutmaya devam eder, yalnız iki taraf birlikte eksik çıkar. Bu suite hem
 * alt sınırın bir daha eklenmemesini hem de kapanış fişinin bilançoda SAYILMAYA
 * devam etmesini kilitler.
 */
describe('GetBalanceSheetHandler — an fotoğrafı semantiği (P0)', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const CASH = '22222222-2222-4222-8222-222222222222';
  const EQUITY = '33333333-3333-4333-8333-333333333333';
  const SALES = '44444444-4444-4444-8444-444444444444';

  const ctx: IGetContext = {
    actor: { userId: 'user-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  const build = () => {
    const calls: TrialBalanceFilter[] = [];

    const journalQueryRepo = {
      trialBalance: jest.fn((filter: TrialBalanceFilter) => {
        calls.push(filter);
        // B 100 Kasa 1000 / A 500 Sermaye 400 + A 600 Satış 600
        return Promise.resolve([
          {
            accountId: CASH,
            totalDebit: new Decimal(1000),
            totalCredit: new Decimal(0),
          },
          {
            accountId: EQUITY,
            totalDebit: new Decimal(0),
            totalCredit: new Decimal(400),
          },
          {
            accountId: SALES,
            totalDebit: new Decimal(0),
            totalCredit: new Decimal(600),
          },
        ]);
      }),
    } as unknown as IJournalQueryRepository;

    const queryBus = {
      execute: jest.fn(() =>
        Promise.resolve({
          data: [
            { id: CASH, code: '100', name: 'Kasa' },
            { id: EQUITY, code: '500', name: 'Sermaye' },
            { id: SALES, code: '600', name: 'Yurtiçi Satışlar' },
          ],
        })
      ),
    } as unknown as TSQueryBus;

    const policyFactory = {
      finance: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({ orThrow: () => undefined }),
        },
        policy: { getSerializationOptions: () => ({}) },
      }),
    } as never;

    return {
      handler: new GetBalanceSheetHandler(
        journalQueryRepo,
        queryBus,
        policyFactory
      ),
      calls,
    };
  };

  it('mizanı ALT SINIR OLMADAN okur — bakiyeler defterin başından birikir', async () => {
    const { handler, calls } = build();
    const asOf = DateTimeManager.create('2026-12-31');

    await handler.execute(
      new GetBalanceSheetQuery({ clinicId: CLINIC_ID, ctx, asOf })
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].dateFrom).toBeUndefined();
    expect(calls[0].dateTo).toBe(asOf);
  });

  it('kapanış fişini DIŞLAMAZ — kârı öz kaynağa taşıyan kayıt odur', async () => {
    const { handler, calls } = build();

    await handler.execute(
      new GetBalanceSheetQuery({ clinicId: CLINIC_ID, ctx })
    );

    // `kinds` verilseydi kapanmış yılda hem 6/7 hem 590 sayılır ve dönem sonucu
    // iki kez görünürdü (gelir tablosu tam tersini yapmak zorunda).
    expect(calls[0].kinds).toBeUndefined();
  });

  it('asOf gün sonuna genişletilmiş hâliyle raporlanır', async () => {
    const { handler } = build();
    const asOf = DateTimeManager.create('2026-12-31');

    const { data } = await handler.execute(
      new GetBalanceSheetQuery({ clinicId: CLINIC_ID, ctx, asOf })
    );

    // Başlıkta ham gece yarısı gösterilse operatör "31 Aralık dahil mi?" sorusunu
    // yanıtlayamazdı; repo da aynı normalizasyonu uyguluyor.
    expect(data.asOf).toEqual(DateTimeManager.endOfDay(asOf));
  });

  it('asOf verilmezse tüm defter — başlıkta null', async () => {
    const { handler, calls } = build();

    const { data } = await handler.execute(
      new GetBalanceSheetQuery({ clinicId: CLINIC_ID, ctx })
    );

    expect(calls[0].dateTo).toBeUndefined();
    expect(data.asOf).toBeNull();
  });

  it('dönem sonucu gelir tablosundan gelir ve bilançoyu dengeler', async () => {
    const { handler } = build();

    const { data } = await handler.execute(
      new GetBalanceSheetQuery({ clinicId: CLINIC_ID, ctx })
    );

    expect(data.totalAssets).toBe('1000.00'); // 100 Kasa
    expect(data.equity.total).toBe('400.00'); // 500 Sermaye
    expect(data.periodResult).toBe('600.00'); // 600 Satış → dönem kârı
    expect(data.totalLiabilitiesAndEquity).toBe('1000.00');
    expect(data.isBalanced).toBe(true);
  });
});
