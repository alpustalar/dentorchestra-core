import { Decimal } from 'decimal.js';
import { GetIncomeStatementHandler } from './get-income-statement.handler';
import { GetIncomeStatementQuery } from './get-income-statement.query';
import { IJournalQueryRepository } from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

/**
 * Karşılaştırma, ekranda "geçen döneme göre" oklarını besler. Kritik olan iki şey:
 * önceki dönemin doğru seçilmesi (bkz. previous-period.calculator) ve açık uçlu
 * raporda karşılaştırmanın hiç üretilmemesi (öncesi tanımsızdır).
 */
describe('GetIncomeStatementHandler — dönem karşılaştırması', () => {
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const SALES_ACCOUNT = '22222222-2222-4222-8222-222222222222';

  const ctx: IGetContext = {
    actor: { userId: 'user-1', clinicId: CLINIC_ID } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

  /** Dönem başlangıcına göre brüt satış üreten sahte mizan. */
  const build = (salesByPeriodStart: Record<string, number>) => {
    const trialBalanceCalls: {
      dateFrom?: Date;
      dateTo?: Date;
      kinds?: readonly string[];
    }[] = [];

    const trialBalance = jest.fn(
      (filter: {
        dateFrom?: Date;
        dateTo?: Date;
        kinds?: readonly string[];
      }) => {
        trialBalanceCalls.push({
          dateFrom: filter.dateFrom,
          dateTo: filter.dateTo,
          kinds: filter.kinds,
        });

        const key = filter.dateFrom?.toISOString() ?? 'open';
        const amount = salesByPeriodStart[key] ?? 0;

        return Promise.resolve([
          {
            accountId: SALES_ACCOUNT,
            totalDebit: new Decimal(0),
            totalCredit: new Decimal(amount),
          },
        ]);
      }
    );

    const journalQueryRepo = {
      trialBalance,
    } as unknown as IJournalQueryRepository;

    const queryBus = {
      execute: jest.fn(() =>
        Promise.resolve({
          data: [{ id: SALES_ACCOUNT, code: '600', name: 'Yurtiçi Satışlar' }],
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
      handler: new GetIncomeStatementHandler(
        journalQueryRepo,
        queryBus,
        policyFactory
      ),
      trialBalance,
      trialBalanceCalls,
    };
  };

  // Controller tarih parametrelerini DateTimeManager ile klinik saat diliminde
  // kurar; test de aynı yoldan kurar ki ay sınırı hizası gerçeği yansıtsın.
  const MARCH_START = DateTimeManager.create('2026-03-01');
  const APRIL_START = DateTimeManager.create('2026-04-01');
  const MAY_START = DateTimeManager.create('2026-05-01');

  it('compare verilmezse karşılaştırma üretilmez ve tek sorgu yapılır', async () => {
    const { handler, trialBalance } = build({
      [APRIL_START.toISOString()]: 1000,
    });

    const { data } = await handler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
      })
    );

    expect(data.comparison).toBeNull();
    expect(trialBalance).toHaveBeenCalledTimes(1);
  });

  it('önceki dönem takvim ayına göre seçilir ve bitişik olur', async () => {
    const { handler, trialBalanceCalls } = build({
      [APRIL_START.toISOString()]: 1000,
      [MARCH_START.toISOString()]: 800,
    });

    await handler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
        compare: true,
      })
    );

    expect(trialBalanceCalls).toHaveLength(2);
    // Nisan (30 gün) takvim ayına hizalı → önceki dönem Mart (31 gün) olur;
    // gün sayısına göre geri gitmek "2 Mart – 1 Nisan" gibi anlamsız bir dönem
    // üretirdi.
    expect(trialBalanceCalls[1].dateFrom).toEqual(MARCH_START);
    expect(trialBalanceCalls[1].dateTo).toEqual(APRIL_START);
  });

  it('yüzde değişimi cari döneme göre hesaplar', async () => {
    const { handler } = build({
      [APRIL_START.toISOString()]: 1000,
      [MARCH_START.toISOString()]: 800,
    });

    const { data } = await handler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
        compare: true,
      })
    );

    expect(data.netSales).toBe('1000.00');
    expect(data.comparison?.previous.netSales).toBe('800.00');
    expect(data.comparison?.deltas.netSalesPct).toBe(25); // (1000-800)/800
    expect(data.comparison?.previous.dateFrom).toEqual(MARCH_START);
  });

  it('önceki dönem sıfırsa artış %100, ikisi de sıfırsa %0', async () => {
    const { handler } = build({ [APRIL_START.toISOString()]: 500 });

    const { data } = await handler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
        compare: true,
      })
    );

    expect(data.comparison?.deltas.netSalesPct).toBe(100);

    const { handler: emptyHandler } = build({});
    const { data: emptyData } = await emptyHandler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
        compare: true,
      })
    );

    expect(emptyData.comparison?.deltas.netSalesPct).toBe(0);
  });

  it('zarardan kâra geçiş pozitif yüzde verir (mutlak değere bölünür)', async () => {
    // Önceki dönemde satış yok ama gider var → negatif net kâr.
    const { handler } = build({
      [APRIL_START.toISOString()]: 1000,
      [MARCH_START.toISOString()]: -500,
    });

    const { data } = await handler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
        compare: true,
      })
    );

    // (1000 − (−500)) / |−500| = %300 — işaretle bölünseydi −%300 çıkardı.
    expect(data.comparison?.deltas.netProfitPct).toBe(300);
  });

  it('tarih aralığı yoksa compare=true yok sayılır', async () => {
    const { handler, trialBalance } = build({ open: 1000 });

    const { data } = await handler.execute(
      new GetIncomeStatementQuery({ clinicId: CLINIC_ID, ctx, compare: true })
    );

    expect(data.comparison).toBeNull();
    expect(trialBalance).toHaveBeenCalledTimes(1);
  });

  /**
   * Kapanış fişi 6/7 hesaplarını ters kayıtla sıfırlar. Gelir tablosu onu sayarsa
   * kapanmış yılın cirosu **sıfır** görünür — kapanış satırları gerçek satışları
   * birebir götürür. Hata sessizdir: kapanış fişi kendi içinde dengeli olduğu için
   * mizanın "Σborç = Σalacak" kontrolü de tutmaya devam eder. Süzgeç handler'ın
   * HER mizan okumasında, karşılaştırma dönemi dahil, bulunmak zorundadır.
   */
  it('her mizan okumasında KAPANIŞ dışı fişler sayılır: OPERATIONAL + ADJUSTING (P0)', async () => {
    const { handler, trialBalanceCalls } = build({
      [APRIL_START.toISOString()]: 1000,
      [MARCH_START.toISOString()]: 800,
    });

    await handler.execute(
      new GetIncomeStatementQuery({
        clinicId: CLINIC_ID,
        ctx,
        dateFrom: APRIL_START,
        dateTo: MAY_START,
        compare: true,
      })
    );

    expect(trialBalanceCalls).toHaveLength(2);
    for (const call of trialBalanceCalls) {
      // CLOSING dışarıda (cirosu sıfırlar); ADJUSTING içeride: tahakkuk ekonomiktir, gider
      // satırı ait olduğu yılın gelir tablosunda görünmek zorundadır.
      expect(call.kinds).toEqual(['OPERATIONAL', 'ADJUSTING']);
      expect(call.kinds).not.toContain('CLOSING');
    }
  });
});
