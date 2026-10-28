'use client';

import { useQuery } from '@tanstack/react-query';
import { metaAdsEndpoints } from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import { metaAdsKeys, type DateRange } from './meta-ads.keys';

/**
 * `totalSpend`/`totalClicks`/`averageCpc` ve kampanya başı `spend`/`clicks`/
 * `cpc` tarih filtreli gerçek veridir (`MetaCampaignMetric` toplamı).
 * `totalLeads`/`convertedLeads`/`costPerLead`/`costPerAppointment` ve
 * kampanya başı `leads`/`conversions` **kırıktır** (tarih aralığını yok
 * sayıyor veya sabit `0` — bkz. frontend-api-endpoint-gaps.md) ve bu feature
 * bu alanları bilerek göstermez; sadece tüketilen alanlar yukarıdakilerdir.
 */
export function useMetaReport({
  clinicId,
  range,
  enabled,
}: {
  clinicId: string | null;
  range: DateRange;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: metaAdsKeys.report(clinicId ?? '', range),
    queryFn: ({ signal }) =>
      api(metaAdsEndpoints.report, {
        params: { clinicId: clinicId ?? '' },
        query: { clinicId: clinicId ?? '', from: range.from, to: range.to },
        signal,
      }),
    enabled: Boolean(clinicId) && enabled,
    retry: false,
  });
}
