'use client';

import { useQuery } from '@tanstack/react-query';
import { metaAdsEndpoints } from '@core-crm/shared/client';

import { api } from '@/lib/api';

import { metaAdsKeys, type DateRange } from './meta-ads.keys';

/**
 * Ajans ROI raporu — `get-agency-roi-report.handler.spec.ts` ile test edilmiş,
 * tarih filtreli `attributedLeads`/`convertedPatients`/`revenue` döner (bkz.
 * `get-meta-report`'un aksine, kırık alan taşımaz).
 */
export function useMetaRoiReport({
  clinicId,
  range,
  enabled,
}: {
  clinicId: string | null;
  range: DateRange;
  enabled: boolean;
}) {
  return useQuery({
    queryKey: metaAdsKeys.roiReport(clinicId ?? '', range),
    queryFn: ({ signal }) =>
      api(metaAdsEndpoints.roiReport, {
        params: { clinicId: clinicId ?? '' },
        query: { from: range.from, to: range.to },
        signal,
      }),
    enabled: Boolean(clinicId) && enabled,
    retry: false,
  });
}
