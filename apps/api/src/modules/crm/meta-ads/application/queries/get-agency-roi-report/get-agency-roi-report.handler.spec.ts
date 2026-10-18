/*
 * Mock'lar (metrik repo, bus) `async` yazılır çünkü taklit ettikleri sözleşme
 * Promise döner; içlerinde `await` yoktur. Kural yalnız bu dosyada kapatılır.
 */
/* eslint-disable @typescript-eslint/require-await */
import { GetAgencyRoiReportHandler } from './get-agency-roi-report.handler';
import { GetAgencyRoiReportQuery } from './get-agency-roi-report.query';
import { GetAdAttributedLeadsQuery } from '@modules/crm/lead/application/queries/get-ad-attributed-leads/get-ad-attributed-leads.query';
import { GetRevenueByPatientsQuery } from '@modules/finance/finance-ledger/application/queries/get-revenue-by-patients/get-revenue-by-patients.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';

describe('GetAgencyRoiReportHandler', () => {
  const clinicId = 'clinic-1';
  const from = new Date('2026-06-01T00:00:00.000Z');
  const to = new Date('2026-06-30T23:59:59.000Z');
  // handler önceki dönemi [from - span, from] olarak hesaplar → prevTo === from.
  const ctx = {} as never;

  function buildHandler(opts: {
    currentSpend: number;
    previousSpend: number;
    currentLeads: {
      campaignId: string;
      campaignName: string;
      patientId: string;
    }[];
    revenueByPatient: Record<string, string>;
    /** Hasta-başı, referans dışı para biriminde gelir (ROAS'a girmemeli). */
    foreignRevenueByPatient?: Record<string, string>;
  }) {
    const metricRepo = {
      aggregateByAccount: jest.fn(async (p: { from: Date }) => {
        const spend =
          p.from.getTime() === from.getTime()
            ? opts.currentSpend
            : opts.previousSpend;
        return [
          {
            campaignId: 'c1',
            campaignName: 'Camp 1',
            spend: { toString: () => String(spend) },
            clicks: 0,
          },
        ] as never;
      }),
    };

    const queryBus = {
      execute: jest.fn(async (q: unknown) => {
        if (q instanceof GetAdAttributedLeadsQuery) {
          const isCurrent = q.payload.from.getTime() === from.getTime();
          return { data: isCurrent ? opts.currentLeads : [] };
        }
        if (q instanceof GetClinicCurrencyQuery) return { data: 'TRY' };
        if (q instanceof GetRevenueByPatientsQuery) {
          const isCurrent = q.from.getTime() === from.getTime();
          if (!isCurrent) return { data: [] };
          return {
            data: [
              ...q.patientIds.map((pid) => ({
                patientId: pid,
                currency: 'TRY',
                revenue: opts.revenueByPatient[pid] ?? '0',
              })),
              ...q.patientIds
                .filter((pid) => opts.foreignRevenueByPatient?.[pid])
                .map((pid) => ({
                  patientId: pid,
                  currency: 'EUR',
                  revenue: opts.foreignRevenueByPatient?.[pid] as string,
                })),
            ],
          };
        }
        return { data: [] };
      }),
    };

    const policyFactory = {
      clinic: () => ({
        evaluator: { check: () => ({ orThrow: () => undefined }) },
        policy: {
          getSerializationOptions: () => ({ groups: [], isGroupActive: false }),
        },
      }),
    };

    return {
      handler: new GetAgencyRoiReportHandler(
        metricRepo as never,
        queryBus as never,
        policyFactory as never
      ),
      metricRepo,
      queryBus,
    };
  }

  it('ROAS/ROI + net kâr + kampanya kırılımını doğru hesaplar', async () => {
    const { handler } = buildHandler({
      currentSpend: 1000,
      previousSpend: 500,
      currentLeads: [
        { campaignId: 'c1', campaignName: 'Camp 1', patientId: 'p1' },
        { campaignId: 'c1', campaignName: 'Camp 1', patientId: 'p2' },
      ],
      revenueByPatient: { p1: '3000', p2: '1000' },
    });

    const { data } = await handler.execute(
      new GetAgencyRoiReportQuery({ clinicId, from, to, ctx })
    );

    expect(data.current.spend).toBe(1000);
    expect(data.current.revenue).toBe(4000);
    expect(data.current.netProfit).toBe(3000);
    expect(data.current.roas).toBe(4);
    expect(data.current.roiPercent).toBe(300);
    expect(data.current.attributedLeads).toBe(2);
    expect(data.current.convertedPatients).toBe(2);

    expect(data.campaigns).toHaveLength(1);
    expect(data.campaigns[0]).toMatchObject({
      campaignId: 'c1',
      spend: 1000,
      attributedLeads: 2,
      convertedPatients: 2,
      revenue: 4000,
      roas: 4,
      roiPercent: 300,
    });
  });

  it('önceki dönemle karşılaştırma (deltas) — önceki gelir 0 ise %100', async () => {
    const { handler } = buildHandler({
      currentSpend: 1000,
      previousSpend: 500,
      currentLeads: [
        { campaignId: 'c1', campaignName: 'Camp 1', patientId: 'p1' },
      ],
      revenueByPatient: { p1: '2000' },
    });

    const { data } = await handler.execute(
      new GetAgencyRoiReportQuery({ clinicId, from, to, ctx })
    );

    expect(data.previous.spend).toBe(500);
    expect(data.previous.revenue).toBe(0);
    expect(data.deltas.spendPct).toBe(100); // (1000-500)/500*100
    expect(data.deltas.revenuePct).toBe(100); // önceki 0 → cari>0
    expect(data.deltas.roasPct).toBe(100);
  });

  it('aynı hasta iki lead ile gelirse gelir/hasta tekil sayılır (double-count yok)', async () => {
    const { handler } = buildHandler({
      currentSpend: 1000,
      previousSpend: 0,
      currentLeads: [
        { campaignId: 'c1', campaignName: 'Camp 1', patientId: 'p1' },
        { campaignId: 'c1', campaignName: 'Camp 1', patientId: 'p1' },
      ],
      revenueByPatient: { p1: '5000' },
    });

    const { data } = await handler.execute(
      new GetAgencyRoiReportQuery({ clinicId, from, to, ctx })
    );

    expect(data.current.attributedLeads).toBe(2); // lead sayısı 2
    expect(data.current.convertedPatients).toBe(1); // distinct hasta 1
    expect(data.current.revenue).toBe(5000); // 5000, 10000 değil
  });

  it("referans dışı para birimindeki gelir ROAS'a katılmaz, ayrıca bildirilir", async () => {
    const { handler } = buildHandler({
      currentSpend: 1000,
      previousSpend: 1000,
      currentLeads: [
        { campaignId: 'c1', campaignName: 'Camp 1', patientId: 'p1' },
      ],
      revenueByPatient: { p1: '2000' },
      foreignRevenueByPatient: { p1: '5000' },
    });

    const { data } = await handler.execute(
      new GetAgencyRoiReportQuery({ clinicId, from, to, ctx })
    );

    // 5000 EUR TRY harcamanın yanına TOPLANMAZ (kur uydurulmaz).
    expect(data.current.revenue).toBe(2000);
    expect(data.current.revenueCurrency).toBe('TRY');
    expect(data.current.excludedRevenueCurrencies).toEqual(['EUR']);
  });
});
