import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetAgencyRoiReportQuery } from './get-agency-roi-report.query';
import { GetAgencyRoiReportResponse } from './get-agency-roi-report.response';
import {
  IMetaCampaignMetricQueryRepository,
  META_CAMPAIGN_METRIC_QUERY_REPOSITORY,
} from '@modules/crm/meta-ads/domain/repositories/meta-campaign-metric.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { META_ADS_EVENTS } from '@src/domain/constants/events';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetAdAttributedLeadsQuery } from '@modules/crm/lead/application/queries/get-ad-attributed-leads/get-ad-attributed-leads.query';
import { GetRevenueByPatientsQuery } from '@modules/finance/finance-ledger/application/queries/get-revenue-by-patients/get-revenue-by-patients.query';
import { GetClinicCurrencyQuery } from '@modules/organization/clinic/application/queries/get-clinic-currency/get-clinic-currency.query';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import {
  RoiCampaignBreakdown,
  RoiPeriodTotals,
} from '@shared/modules/meta-ads/interfaces';
import type { CurrencyType } from '@input-type-schemas/CurrencySchema';

interface CampaignAgg {
  campaignName: string;
  spend: number;
  attributedLeads: number;
  patients: Set<string>;
  revenue: number;
}

interface PeriodResult {
  totals: RoiPeriodTotals;
  campaigns: RoiCampaignBreakdown[];
}

interface ComputePeriodInput {
  clinicId: string;
  from: Date;
  to: Date;
  campaignId?: string;
  /** ROAS'ın hesaplandığı para birimi (kliniğin fonksiyonel parası). */
  referenceCurrency: CurrencyType;
}

@QueryHandler(GetAgencyRoiReportQuery)
export class GetAgencyRoiReportHandler
  implements IQueryHandler<GetAgencyRoiReportQuery, GetAgencyRoiReportResponse>
{
  constructor(
    @Inject(META_CAMPAIGN_METRIC_QUERY_REPOSITORY)
    private readonly metaCampaignMetricRepo: IMetaCampaignMetricQueryRepository,
    private readonly queryBus: TSQueryBus,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetAgencyRoiReportQuery
  ): Promise<GetAgencyRoiReportResponse> {
    const { clinicId, from, to, campaignId, ctx } = query.payload;

    const { evaluator, policy } = this.policyFactory.clinic(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.actorCanAccessTargetClinic(clinicId),
        'Bu kliniğin ROI raporuna erişim yetkiniz yok.'
      )
      .orThrow(META_ADS_EVENTS.ROI_REPORT);

    // Önceki eşit uzunlukta dönem: [from - span, from].
    const spanMinutes = DateTimeManager.diffInMinutes(to, from);
    const prevTo = from;
    const prevFrom = DateTimeManager.addMinutes(from, -spanMinutes);

    // Gelir para birimi başına geliyor; ROAS tek para biriminde anlamlı.
    // Referans, kliniğin fonksiyonel para birimidir (Model A, doc 07) — diğer
    // para birimleri rapora kur UYDURULARAK karıştırılmaz, ayrıca bildirilir.
    const { data: referenceCurrency } = await this.queryBus.execute(
      new GetClinicCurrencyQuery(clinicId)
    );

    const [current, previous] = await Promise.all([
      this.computePeriod({
        clinicId,
        from,
        to,
        campaignId,
        referenceCurrency,
      }),
      this.computePeriod({
        clinicId,
        from: prevFrom,
        to: prevTo,
        campaignId,
        referenceCurrency,
      }),
    ]);

    return {
      data: {
        period: { from, to },
        current: current.totals,
        previous: previous.totals,
        deltas: {
          spendPct: this.pctChange(previous.totals.spend, current.totals.spend),
          revenuePct: this.pctChange(
            previous.totals.revenue,
            current.totals.revenue
          ),
          roasPct: this.pctChange(previous.totals.roas, current.totals.roas),
        },
        campaigns: current.campaigns,
      },
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }

  private async computePeriod({
    clinicId,
    from,
    to,
    campaignId,
    referenceCurrency,
  }: ComputePeriodInput): Promise<PeriodResult> {
    const map = new Map<string, CampaignAgg>();

    // 1) Harcama (kampanya-başı).
    const metrics = await this.metaCampaignMetricRepo.aggregateByAccount({
      clinicId,
      from,
      to,
      campaignId,
    });
    for (const m of metrics) {
      const agg = this.getOrInit(map, m.campaignId, m.campaignName);
      agg.spend += parseFloat(m.spend.toString());
    }

    // 2) Reklam-atıflı dönüşen lead'ler (kampanya → hasta).
    const { data: attributed } = await this.queryBus.execute(
      new GetAdAttributedLeadsQuery({ clinicId, from, to })
    );
    const leads = campaignId
      ? attributed.filter((l) => l.campaignId === campaignId)
      : attributed;

    // 3) Bu hastaların dönem içi geliri.
    const patientIds = [...new Set(leads.map((l) => l.patientId))];
    const { data: revenues } = await this.queryBus.execute(
      new GetRevenueByPatientsQuery(patientIds, from, to)
    );

    // Referans dışı para birimleri ROAS'a KATILMAZ ama sessizce düşmez:
    // raporda hangi para birimlerinin dışarıda kaldığı bildirilir (aksi halde
    // 1.000 EUR tahsilat TRY harcamanın yanına toplanıp ROAS'ı uyduruyordu).
    const excludedRevenueCurrencies = [
      ...new Set(
        revenues
          .filter((r) => r.currency !== referenceCurrency)
          .map((r) => r.currency)
      ),
    ];

    const revByPatient = new Map<string, number>();
    for (const row of revenues) {
      if (row.currency !== referenceCurrency) continue;
      revByPatient.set(
        row.patientId,
        (revByPatient.get(row.patientId) ?? 0) + parseFloat(row.revenue)
      );
    }

    // 4) Lead'leri kampanyalara dağıt.
    for (const l of leads) {
      const agg = this.getOrInit(
        map,
        l.campaignId,
        l.campaignName ?? l.campaignId
      );
      agg.attributedLeads += 1;
      agg.patients.add(l.patientId);
    }
    for (const agg of map.values()) {
      let rev = 0;
      for (const pid of agg.patients) rev += revByPatient.get(pid) ?? 0;
      agg.revenue = rev;
    }

    const campaigns: RoiCampaignBreakdown[] = [...map.entries()].map(
      ([cid, a]) => ({
        campaignId: cid,
        campaignName: a.campaignName,
        spend: this.round(a.spend),
        attributedLeads: a.attributedLeads,
        convertedPatients: a.patients.size,
        revenue: this.round(a.revenue),
        roas: a.spend > 0 ? this.round(a.revenue / a.spend) : 0,
        roiPercent:
          a.spend > 0 ? this.round(((a.revenue - a.spend) / a.spend) * 100) : 0,
      })
    );

    // Toplamlar: hasta double-count'ı önlemek için distinct küme üzerinden.
    const totalSpend = this.round(
      [...map.values()].reduce((s, a) => s + a.spend, 0)
    );
    const distinctPatients = new Set(leads.map((l) => l.patientId));
    const totalRevenue = this.round(
      [...distinctPatients].reduce(
        (s, pid) => s + (revByPatient.get(pid) ?? 0),
        0
      )
    );

    const totals: RoiPeriodTotals = {
      spend: totalSpend,
      revenue: totalRevenue,
      netProfit: this.round(totalRevenue - totalSpend),
      roas: totalSpend > 0 ? this.round(totalRevenue / totalSpend) : 0,
      roiPercent:
        totalSpend > 0
          ? this.round(((totalRevenue - totalSpend) / totalSpend) * 100)
          : 0,
      attributedLeads: leads.length,
      convertedPatients: distinctPatients.size,
      revenueCurrency: referenceCurrency,
      excludedRevenueCurrencies,
    };

    return { totals, campaigns };
  }

  private getOrInit(
    map: Map<string, CampaignAgg>,
    campaignId: string,
    campaignName: string
  ): CampaignAgg {
    let agg = map.get(campaignId);
    if (!agg) {
      agg = {
        campaignName,
        spend: 0,
        attributedLeads: 0,
        patients: new Set<string>(),
        revenue: 0,
      };
      map.set(campaignId, agg);
    }
    return agg;
  }

  /** Önceki döneme göre % değişim; önceki 0 ise cari>0 → 100, cari=0 → 0. */
  private pctChange(previous: number, current: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return this.round(((current - previous) / previous) * 100);
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
