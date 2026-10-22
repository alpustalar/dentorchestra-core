'use client';

import { useLocale, useTranslations } from 'next-intl';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { AgencyRoiReport } from '@core-crm/shared/client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

import {
  EmptyState,
  errorMessage,
  formatMoney,
  formatNumber,
  formatPercent,
  Notice,
} from './panel-ui';

interface RoiPanelProps {
  report: AgencyRoiReport | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

/**
 * Veriyi kendisi çekmez — `MetaAdsContent` çeker ve `SpendReportPanel`'le
 * para birimini (`current.revenueCurrency`) paylaşır; `get-meta-report`
 * kendi para birimini döndürmediği için tek gerçek kaynak budur.
 */
export function RoiPanel({ report, isLoading, isError, error }: RoiPanelProps) {
  const t = useTranslations('MetaAds');
  const locale = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('roiTitle')}</CardTitle>
        <CardDescription>{t('roiDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && <Notice error message={errorMessage(error) ?? t('roiLoadError')} />}

        {isLoading ? (
          <EmptyState label={t('loading')} />
        ) : !report ? (
          <EmptyState label={t('roiEmpty')} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label={t('spend')}
                value={formatMoney(report.current.spend, report.current.revenueCurrency, locale)}
                deltaPct={report.deltas.spendPct}
              />
              <StatTile
                label={t('revenue')}
                value={formatMoney(report.current.revenue, report.current.revenueCurrency, locale)}
                deltaPct={report.deltas.revenuePct}
              />
              <StatTile
                label={t('netProfit')}
                value={formatMoney(report.current.netProfit, report.current.revenueCurrency, locale)}
              />
              <StatTile
                label={t('roas')}
                value={`${report.current.roas.toFixed(2)}x`}
                deltaPct={report.deltas.roasPct}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label={t('roiPercent')} value={formatPercent(report.current.roiPercent, locale)} />
              <MiniStat
                label={t('attributedLeads')}
                value={formatNumber(report.current.attributedLeads, locale)}
              />
              <MiniStat
                label={t('convertedPatients')}
                value={formatNumber(report.current.convertedPatients, locale)}
              />
            </div>

            {report.current.excludedRevenueCurrencies.length > 0 && (
              <Notice
                message={t('excludedCurrenciesNotice', {
                  currencies: report.current.excludedRevenueCurrencies.join(', '),
                })}
              />
            )}

            <div>
              <h3 className="mb-2 text-sm font-medium">{t('campaignBreakdownTitle')}</h3>
              {report.campaigns.length === 0 ? (
                <EmptyState label={t('campaignBreakdownEmpty')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">{t('columnCampaign')}</th>
                        <th className="pb-2 pr-3 text-right font-medium">{t('columnSpend')}</th>
                        <th className="pb-2 pr-3 text-right font-medium">{t('columnRevenue')}</th>
                        <th className="pb-2 pr-3 text-right font-medium">{t('columnRoas')}</th>
                        <th className="pb-2 pr-3 text-right font-medium">{t('columnRoiPercent')}</th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          {t('columnAttributedLeads')}
                        </th>
                        <th className="pb-2 text-right font-medium">
                          {t('columnConvertedPatients')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.campaigns.map((campaign) => (
                        <tr key={campaign.campaignId} className="border-b last:border-0">
                          <td className="max-w-56 truncate py-2.5 pr-3">
                            {campaign.campaignName}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatMoney(campaign.spend, report.current.revenueCurrency, locale)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatMoney(campaign.revenue, report.current.revenueCurrency, locale)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {campaign.roas.toFixed(2)}x
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatPercent(campaign.roiPercent, locale)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatNumber(campaign.attributedLeads, locale)}
                          </td>
                          <td className="py-2.5 text-right tabular-nums">
                            {formatNumber(campaign.convertedPatients, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  deltaPct,
}: {
  label: string;
  value: string;
  deltaPct?: number;
}) {
  const hasDelta = typeof deltaPct === 'number' && Number.isFinite(deltaPct);
  const positive = !hasDelta || deltaPct! >= 0;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {hasDelta && (
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold',
              positive
                ? 'bg-emerald-500/15 text-emerald-600'
                : 'bg-destructive/15 text-destructive'
            )}
          >
            {positive ? (
              <TrendingUp className="size-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="size-3" aria-hidden="true" />
            )}
            {deltaPct! >= 0 ? '+' : ''}
            {deltaPct!.toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
