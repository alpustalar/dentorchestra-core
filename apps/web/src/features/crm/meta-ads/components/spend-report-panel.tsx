'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { MetaReportResponse } from '@dentorchestra/shared/client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { EmptyState, errorMessage, formatMoney, formatNumber, Notice } from './panel-ui';

interface SpendReportPanelProps {
  report: MetaReportResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /**
   * `MetaReportResponse` kendi para birimini döndürmez — ROI raporunun
   * `current.revenueCurrency`'si (klinik fonksiyonel para birimi) `MetaAdsContent`
   * tarafından buraya aktarılır; henüz yüklenmediyse 'TRY' varsayılan.
   */
  currency: string;
}

/**
 * Yalnız harcama/tıklama/CPC gösterir — `totalLeads`/`convertedLeads`/
 * `costPerLead`/`costPerAppointment` ve kampanya başı `leads`/`conversions`
 * tarih aralığını yok sayıp sabit `0` döndüğü için bilerek dışarıda
 * bırakıldı (bkz. `use-meta-report.ts`).
 */
export function SpendReportPanel({
  report,
  isLoading,
  isError,
  error,
  currency,
}: SpendReportPanelProps) {
  const t = useTranslations('MetaAds');
  const locale = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('spendReportTitle')}</CardTitle>
        <CardDescription>{t('spendReportDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && (
          <Notice error message={errorMessage(error) ?? t('spendReportLoadError')} />
        )}

        {isLoading ? (
          <EmptyState label={t('loading')} />
        ) : !report ? (
          <EmptyState label={t('spendReportEmpty')} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label={t('totalSpend')} value={formatMoney(report.totalSpend, currency, locale)} />
              <MiniStat label={t('totalClicks')} value={formatNumber(report.totalClicks, locale)} />
              <MiniStat
                label={t('averageCpc')}
                value={formatMoney(report.averageCpc, currency, locale)}
              />
            </div>

            {report.campaigns.length === 0 ? (
              <EmptyState label={t('spendReportEmpty')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3 font-medium">{t('columnCampaign')}</th>
                      <th className="pb-2 pr-3 text-right font-medium">{t('columnSpend')}</th>
                      <th className="pb-2 pr-3 text-right font-medium">{t('columnClicks')}</th>
                      <th className="pb-2 text-right font-medium">{t('columnCpc')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.campaigns.map((campaign) => (
                      <tr key={campaign.campaignId} className="border-b last:border-0">
                        <td className="max-w-56 truncate py-2.5 pr-3">{campaign.campaignName}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatMoney(campaign.spend, currency, locale)}
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums">
                          {formatNumber(campaign.clicks, locale)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatMoney(campaign.cpc, currency, locale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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
