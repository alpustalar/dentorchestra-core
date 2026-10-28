'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DateTimeManager } from '@shared/common';
import { Megaphone } from 'lucide-react';
import type {
  AgencyRoiReport,
  MetaAdAccountResponse,
  MetaLeadResponse,
  MetaReportResponse,
} from '@dentorchestra/shared/client';

import { Badge } from '@/components/ui/badge';
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

import { useMetaAdAccounts } from '../api/use-meta-ad-accounts';
import { useMetaRoiReport } from '../api/use-meta-roi-report';
import { useMetaReport } from '../api/use-meta-report';
import type { DateRange } from '../api/meta-ads.keys';
import { ConnectionPanel } from './connection-panel';
import { RoiPanel } from './roi-panel';
import { SpendReportPanel } from './spend-report-panel';
import { LeadsPanel } from './leads-panel';
import { Notice } from './panel-ui';
import { DEMO_ACCOUNTS, DEMO_LEADS, DEMO_REPORT, DEMO_ROI_REPORT } from './demo-data';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const FALLBACK_CURRENCY = 'TRY';

export function MetaAdsWorkspace() {
  if (mockingEnabled) return <MockMetaAds />;

  return (
    <AuthProvider>
      <LiveMetaAds />
    </AuthProvider>
  );
}

function MockMetaAds() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <MetaAdsContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canManageAccounts
      canMatchLeads
      isDemo
    />
  );
}

function LiveMetaAds() {
  const { actor, status } = useAuth();

  return (
    <MetaAdsContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canManageAccounts={
        actorHasCapability(actor, 'metaadaccount:create') ||
        actorHasCapability(actor, 'metaadaccount:delete')
      }
      canMatchLeads={actorHasCapability(actor, 'metalead:update')}
      isDemo={false}
    />
  );
}

function MetaAdsContent({
  clinicId,
  status,
  canManageAccounts,
  canMatchLeads,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canManageAccounts: boolean;
  canMatchLeads: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('MetaAds');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [range, setRange] = useState<DateRange>(defaultRange);
  const [showConnectedBanner, setShowConnectedBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get('connected') === '1') {
      setShowConnectedBanner(true);
      router.replace(pathname);
    }
    // `searchParams`/`router` her render'da yeni referans — yalnız mount'ta
    // (ve path değişirse) bakılır, sonsuz döngüye girilmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const hasScope =
    status === 'authenticated' && (isDemo ? Boolean(clinicId) : isUuid(clinicId));
  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const queriesEnabled = hasScope && validRange;

  const accountsQuery = useMetaAdAccounts(isDemo ? null : clinicId);
  const accounts: MetaAdAccountResponse[] = isDemo
    ? DEMO_ACCOUNTS
    : accountsQuery.data ?? [];

  const roiQuery = useMetaRoiReport({
    clinicId,
    range,
    enabled: queriesEnabled && !isDemo,
  });
  const roiReport: AgencyRoiReport | undefined = isDemo ? DEMO_ROI_REPORT : roiQuery.data;
  const currency = roiReport?.current.revenueCurrency ?? FALLBACK_CURRENCY;

  const reportQuery = useMetaReport({
    clinicId,
    range,
    enabled: queriesEnabled && !isDemo,
  });
  const report: MetaReportResponse | undefined = isDemo ? DEMO_REPORT : reportQuery.data;

  const setRangeField = (key: keyof DateRange, value: string) => {
    setRange((current) => ({ ...current, [key]: value }));
  };

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Megaphone className="size-4" aria-hidden="true" />
            <span>{t('eyebrow')}</span>
            {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {hasScope
              ? t('description')
              : status === 'unauthenticated'
                ? t('noSession')
                : t('noClinic')}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t('from')}
            <input
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              type="date"
              value={range.from}
              onChange={(event) => setRangeField('from', event.target.value)}
              disabled={!hasScope}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t('to')}
            <input
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              type="date"
              value={range.to}
              onChange={(event) => setRangeField('to', event.target.value)}
              disabled={!hasScope}
            />
          </label>
        </div>
      </header>

      {!validRange && <Notice error message={t('invalidRange')} />}
      {showConnectedBanner && <Notice message={t('connectedSuccessBanner')} />}

      {hasScope && (
        <>
          <ConnectionPanel
            clinicId={clinicId ?? ''}
            accounts={accounts}
            isLoading={!isDemo && accountsQuery.isPending}
            isError={!isDemo && accountsQuery.isError}
            canManage={canManageAccounts}
            isDemo={isDemo}
          />

          <RoiPanel
            report={roiReport}
            isLoading={!isDemo && queriesEnabled && roiQuery.isPending}
            isError={!isDemo && roiQuery.isError}
            error={roiQuery.error}
          />

          <SpendReportPanel
            report={report}
            isLoading={!isDemo && queriesEnabled && reportQuery.isPending}
            isError={!isDemo && reportQuery.isError}
            error={reportQuery.error}
            currency={currency}
          />

          <LeadsPanel
            clinicId={clinicId}
            isDemo={isDemo}
            demoLeads={DEMO_LEADS}
            canMatch={canMatchLeads}
          />
        </>
      )}
    </main>
  );
}

function defaultRange(): DateRange {
  const today = DateTimeManager.create();
  return {
    from: DateTimeManager.toDateString(DateTimeManager.subtractDays(today, 30)),
    to: DateTimeManager.toDateString(today),
  };
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value
      )
  );
}
