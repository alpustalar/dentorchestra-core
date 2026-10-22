'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useEffect, useMemo, useState } from 'react';
import { DateTimeManager } from '@shared/common';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Loader2,
  RefreshCw,
  Stethoscope,
  UsersRound,
} from 'lucide-react';

import { usePartyFindParties } from '@/api/generated/party-query/party-query';
import { useFinanceLedgerGetPatientLedger } from '@/api/generated/finance-ledger-query/finance-ledger-query';
import {
  usePaymentReportsArAging,
  usePaymentReportsProviderRevenue,
} from '@/api/generated/payment-reports-query/payment-reports-query';
import type {
  ArAgingBucketResponseDto,
  ArAgingPatientRiskResponseDto,
  ArAgingReportResponseDto,
  ArAgingSummaryResponseDto,
  PartyFindPartiesParams,
  PartyResponseDto,
  PatientLedgerItemResponseDto,
  ProviderRevenueReportResponseDto,
} from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import { formatShortDate } from '@/lib/date-time';
import { formatMoney } from '@/features/finance/shared/utils/money-formatter.util';
import {
  PaymentCollectionSheet,
  type CompletedPaymentCollection,
} from '@/features/finance/payment/components/payment-collection-sheet';
import { AuthProvider, useAuth, type AuthStatus } from '@/lib/auth';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const emptyParties: PartyResponseDto[] = [];
const patientLedgerPageSize = 10;
type PatientLedgerRow = Omit<
  PatientLedgerItemResponseDto,
  'amount' | 'currency'
> & {
  amount?: string;
  currency?: string;
};
type CollectionFeedback = CompletedPaymentCollection & { completedAt: string };
const emptyAging: ArAgingReportResponseDto = {
  clinicId: '',
  asOf: '',
  buckets: [],
  patients: [],
  summaries: [],
};
const emptyRevenue: ProviderRevenueReportResponseDto = {
  clinicId: '',
  dateFrom: null,
  dateTo: null,
  lines: [],
  totals: [],
};

type ReportFilters = {
  asOf: string;
  dateFrom: string;
  dateTo: string;
};

export function PaymentsWorkspace() {
  if (mockingEnabled) return <MockPayments />;

  return (
    <AuthProvider>
      <LivePayments />
    </AuthProvider>
  );
}

function MockPayments() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <PaymentsContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      isDemo
    />
  );
}

function LivePayments() {
  const { actor, status } = useAuth();

  return (
    <PaymentsContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      isDemo={false}
    />
  );
}

function PaymentsContent({
  clinicId,
  status,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  isDemo: boolean;
}) {
  const t = useTranslations('FinancePayment.workspace');
  const locale = useLocale();
  const initialFilters = useMemo(createInitialFilters, []);
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [collectionParty, setCollectionParty] =
    useState<PartyResponseDto | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [lastCollection, setLastCollection] =
    useState<CollectionFeedback | null>(null);

  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setSelectedPartyId('');
    setCollectionParty(null);
    setLastCollection(null);
  }, [clinicId]);

  useEffect(() => {
    setLedgerPage(1);
  }, [selectedPartyId]);

  const agingQuery = usePaymentReportsArAging(
    { asOf: filters.asOf },
    { query: { enabled: hasScope && !isDemo, retry: false } }
  );
  const revenueQuery = usePaymentReportsProviderRevenue(
    { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    { query: { enabled: hasScope && !isDemo, retry: false } }
  );
  const partyParams = {
    clinicId: clinicId ?? '',
    role: 'PATIENT',
    limit: 100,
    page: 1,
    orderBy: 'asc' as const,
    orderByColumn: 'name',
  } as PartyFindPartiesParams;
  const partiesQuery = usePartyFindParties(partyParams, {
    query: { enabled: hasScope && !isDemo, retry: false },
  });

  const aging = isDemo
    ? createDemoAging(filters.asOf, lastCollection)
    : readAgingReport(agingQuery.data?.data);
  const revenue = isDemo
    ? createDemoRevenue(filters.dateFrom, filters.dateTo)
    : readRevenueReport(revenueQuery.data?.data);
  const parties = isDemo
    ? demoParties
    : (partiesQuery.data?.data ?? emptyParties);
  const partyByPatientId = useMemo(
    () =>
      new Map(
        parties
          .filter((party) => party.originType === 'PATIENT' && party.originId)
          .map((party) => [party.originId!, party])
      ),
    [parties]
  );
  const selectedParty = parties.find((party) => party.id === selectedPartyId);
  const selectedPatientId =
    selectedParty?.originType === 'PATIENT'
      ? (selectedParty.originId ?? '')
      : '';
  const patientLedgerQuery = useFinanceLedgerGetPatientLedger(
    selectedPatientId,
    {
      page: ledgerPage,
      limit: patientLedgerPageSize,
      orderBy: 'desc',
      orderByColumn: 'entryDate',
    },
    {
      query: {
        enabled: hasScope && !isDemo && Boolean(selectedPatientId),
        retry: false,
      },
    }
  );
  const demoPatientLedger = useMemo(() => {
    const items = createDemoPatientLedger(selectedPatientId);
    if (lastCollection?.patientId !== selectedPatientId) return items;
    return [
      {
        id: `demo-ledger-${lastCollection.completedAt}`,
        category: 'TREATMENT_PAYMENT',
        entryDate: lastCollection.completedAt,
        status: 'COMPLETED',
        description: null,
        paymentMethod: 'CREDIT_CARD',
        providerName: null,
        amount: String(lastCollection.amount),
        currency: lastCollection.currency,
      },
      ...items,
    ];
  }, [lastCollection, selectedPatientId]);
  const patientLedger = isDemo
    ? demoPatientLedger.slice(
        (ledgerPage - 1) * patientLedgerPageSize,
        ledgerPage * patientLedgerPageSize
      )
    : readPatientLedger(patientLedgerQuery.data?.data);
  const patientLedgerPagination = isDemo
    ? {
        total: demoPatientLedger.length,
        page: ledgerPage,
        limit: patientLedgerPageSize,
        totalPages: Math.max(
          1,
          Math.ceil(demoPatientLedger.length / patientLedgerPageSize)
        ),
      }
    : patientLedgerQuery.data?.meta?.pagination;
  const isLoading =
    status === 'loading' ||
    (hasScope &&
      !isDemo &&
      (agingQuery.isPending ||
        revenueQuery.isPending ||
        partiesQuery.isPending));
  const hasError =
    !isDemo &&
    (agingQuery.isError || revenueQuery.isError || partiesQuery.isError);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidRange(draftFilters)) return;
    setFilters(draftFilters);
  };

  const openCollection = (party: PartyResponseDto | undefined) => {
    if (!party) return;
    setSelectedPartyId(party.id);
    setCollectionParty(party);
  };

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDollarSign className="size-4" aria-hidden="true" />
            <span>{t('eyebrow')}</span>
            {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {hasScope
              ? t('description')
              : status === 'unauthenticated'
                ? t('noSession')
                : t('noClinic')}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <label className="min-w-0 sm:w-72">
            <span className="sr-only">{t('patient')}</span>
            <SelectInput
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selectedPartyId}
              onChange={(event) => setSelectedPartyId(event.target.value)}
              disabled={!hasScope || isLoading}
            >
              <option value="">{t('selectPatient')}</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </SelectInput>
          </label>
          <Button
            className="min-h-11"
            disabled={!selectedParty}
            onClick={() => openCollection(selectedParty)}
          >
            <CreditCard className="size-4" aria-hidden="true" />
            {t('collectPayment')}
          </Button>
        </div>
      </header>

      <Card>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
            onSubmit={applyFilters}
          >
            <DateField
              label={t('asOf')}
              value={draftFilters.asOf}
              onChange={(asOf) =>
                setDraftFilters((current) => ({ ...current, asOf }))
              }
              disabled={!hasScope}
            />
            <DateField
              label={t('dateFrom')}
              value={draftFilters.dateFrom}
              max={draftFilters.dateTo}
              onChange={(dateFrom) =>
                setDraftFilters((current) => ({ ...current, dateFrom }))
              }
              disabled={!hasScope}
            />
            <DateField
              label={t('dateTo')}
              value={draftFilters.dateTo}
              min={draftFilters.dateFrom}
              onChange={(dateTo) =>
                setDraftFilters((current) => ({ ...current, dateTo }))
              }
              disabled={!hasScope}
            />
            <Button
              className="min-h-11"
              type="submit"
              variant="outline"
              disabled={!hasScope || !isValidRange(draftFilters)}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {t('apply')}
            </Button>
          </form>
          {!isValidRange(draftFilters) && (
            <p className="mt-3 text-sm text-destructive">{t('invalidRange')}</p>
          )}
        </CardContent>
      </Card>

      {lastCollection && (
        <CollectionSuccess
          collection={lastCollection}
          onDismiss={() => setLastCollection(null)}
        />
      )}

      {hasError && <Notice label={t('loadError')} />}
      {!hasScope ? (
        <EmptyState
          label={status === 'unauthenticated' ? t('noSession') : t('noClinic')}
        />
      ) : isLoading ? (
        <LoadingState label={t('loading')} />
      ) : (
        <>
          <PatientLedgerCard
            party={selectedParty}
            items={patientLedger}
            pagination={patientLedgerPagination}
            page={ledgerPage}
            locale={locale}
            isLoading={patientLedgerQuery.isPending && !isDemo}
            isError={patientLedgerQuery.isError && !isDemo}
            onPageChange={setLedgerPage}
          />
          <SummaryGrid summaries={aging.summaries} />
          <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
            <AgingCard
              report={aging}
              parties={partyByPatientId}
              locale={locale}
              onCollect={openCollection}
            />
            <ProviderRevenueCard report={revenue} />
          </div>
        </>
      )}

      <PaymentCollectionSheet
        party={collectionParty}
        clinicId={clinicId ?? ''}
        open={Boolean(collectionParty)}
        isDemo={isDemo}
        onCompleted={(collection) => {
          setLastCollection({
            ...collection,
            completedAt: DateTimeManager.toIsoString(DateTimeManager.create()),
          });
          setSelectedPartyId(collection.partyId);
          setCollectionParty(null);
        }}
        onOpenChange={(open) => {
          if (!open) setCollectionParty(null);
        }}
      />
    </main>
  );
}

function CollectionSuccess({
  collection,
  onDismiss,
}: {
  collection: CompletedPaymentCollection;
  onDismiss: () => void;
}) {
  const t = useTranslations('FinancePayment.workspace');

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-emerald-800 sm:flex-row sm:items-center sm:justify-between dark:text-emerald-200"
      role="status"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">{t('collectionSuccessTitle')}</p>
          <p className="mt-0.5 text-sm">
            {t('collectionSuccessDescription', {
              name: collection.partyName,
              amount:
                formatMoney(String(collection.amount), collection.currency) ??
                '—',
            })}
          </p>
          <p className="mt-1 text-xs opacity-80">
            {t('collectionSuccessRefresh')}
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" onClick={onDismiss}>
        {t('dismiss')}
      </Button>
    </div>
  );
}

function PatientLedgerCard({
  party,
  items,
  pagination,
  page,
  locale,
  isLoading,
  isError,
  onPageChange,
}: {
  party: PartyResponseDto | undefined;
  items: PatientLedgerRow[];
  pagination:
    | { total: number; page: number; limit: number; totalPages: number }
    | undefined;
  page: number;
  locale: string;
  isLoading: boolean;
  isError: boolean;
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations('FinancePayment.workspace');
  const categoryLabel = (value: string) => {
    switch (value) {
      case 'TREATMENT_PAYMENT':
        return t('ledger.category.TREATMENT_PAYMENT');
      case 'REFUND':
        return t('ledger.category.REFUND');
      case 'SERVICE_CHARGE':
        return t('ledger.category.SERVICE_CHARGE');
      default:
        return t('ledger.category.OTHER');
    }
  };
  const methodLabel = (value: string) => {
    switch (value) {
      case 'CASH':
        return t('ledger.paymentMethod.CASH');
      case 'CREDIT_CARD':
        return t('ledger.paymentMethod.CREDIT_CARD');
      case 'BANK_TRANSFER':
        return t('ledger.paymentMethod.BANK_TRANSFER');
      case 'EFT':
        return t('ledger.paymentMethod.EFT');
      case 'MAIL_ORDER':
        return t('ledger.paymentMethod.MAIL_ORDER');
      case 'CHEQUE':
        return t('ledger.paymentMethod.CHEQUE');
      case 'BOND':
        return t('ledger.paymentMethod.BOND');
      default:
        return t('ledger.paymentMethod.OTHER');
    }
  };
  const statusLabel = (value: string) => {
    switch (value) {
      case 'COMPLETED':
        return t('ledger.statusValue.COMPLETED');
      case 'REFUNDED':
        return t('ledger.statusValue.REFUNDED');
      case 'CANCELLED':
        return t('ledger.statusValue.CANCELLED');
      case 'CHARGED_BACK':
        return t('ledger.statusValue.CHARGED_BACK');
      default:
        return t('ledger.statusValue.OTHER');
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t('ledger.title')}</CardTitle>
        <CardDescription>
          {party
            ? t('ledger.description', { name: party.name })
            : t('ledger.selectPatient')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!party ? (
          <InlineEmpty label={t('ledger.selectPatient')} />
        ) : isLoading ? (
          <div className="flex min-h-28 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('ledger.loading')}
          </div>
        ) : isError ? (
          <Notice label={t('ledger.loadError')} />
        ) : items.length === 0 ? (
          <InlineEmpty label={t('ledger.empty')} />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('ledger.date')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('ledger.transaction')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('ledger.method')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('ledger.provider')}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t('ledger.status')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('ledger.amount')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatShortDate(item.entryDate, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {categoryLabel(item.category)}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 max-w-xs truncate text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.paymentMethod
                        ? methodLabel(item.paymentMethod)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {item.providerName ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {statusLabel(item.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {formatMoney(item.amount, item.currency) ??
                        t('ledger.masked')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {party && pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {t('ledger.pagination', {
                page: pagination.page,
                totalPages: pagination.totalPages,
                total: pagination.total,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('ledger.previous')}
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label={t('ledger.next')}
                disabled={page >= pagination.totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryGrid({
  summaries,
}: {
  summaries: ArAgingSummaryResponseDto[];
}) {
  const t = useTranslations('FinancePayment.workspace');
  const locale = useLocale();

  if (summaries.length === 0) return <EmptyState label={t('emptySummary')} />;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {summaries.map((summary) => {
        const rate = decimalRateToPercent(summary.collectionRate);
        return (
          <Card key={summary.currency}>
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>
                  {t('currencySummary', { currency: summary.currency })}
                </CardTitle>
                <Badge variant="secondary">{formatPercent(rate, locale)}</Badge>
              </div>
              <CardDescription>{t('collectionRate')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={rate} aria-label={t('collectionRate')} />
              <dl className="grid grid-cols-3 gap-3">
                <Metric
                  label={t('collected')}
                  value={
                    formatMoney(summary.totalCollected, summary.currency) ?? '—'
                  }
                />
                <Metric
                  label={t('outstanding')}
                  value={
                    formatMoney(summary.totalOutstanding, summary.currency) ??
                    '—'
                  }
                />
                <Metric
                  label={t('overdue')}
                  value={
                    formatMoney(summary.totalOverdue, summary.currency) ?? '—'
                  }
                  destructive={summary.totalOverdue !== '0.00'}
                />
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function AgingCard({
  report,
  parties,
  locale,
  onCollect,
}: {
  report: ArAgingReportResponseDto;
  parties: Map<string, PartyResponseDto>;
  locale: string;
  onCollect: (party: PartyResponseDto | undefined) => void;
}) {
  const t = useTranslations('FinancePayment.workspace');

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{t('agingTitle')}</CardTitle>
        <CardDescription>
          {report.asOf
            ? t('agingDescription', {
                date: formatShortDate(report.asOf, locale),
              })
            : t('agingEmptyDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {report.buckets.length > 0 && <AgingBuckets buckets={report.buckets} />}
        {report.patients.length === 0 ? (
          <InlineEmpty label={t('noReceivables')} />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('patient')}</th>
                  <th className="px-4 py-3 font-medium">
                    {t('oldestDueDate')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('outstanding')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('overdue')}
                  </th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.patients.map((risk) => {
                  const party = parties.get(risk.patientId);
                  return (
                    <tr
                      key={`${risk.patientId}-${risk.currency}`}
                      className="border-t"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {party?.name ?? t('unknownPatient')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {shortId(risk.patientId)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {risk.oldestDueDate
                          ? formatShortDate(risk.oldestDueDate, locale)
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatMoney(risk.outstanding, risk.currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-destructive tabular-nums">
                        {formatMoney(risk.overdue, risk.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!party}
                          onClick={() => onCollect(party)}
                        >
                          {t('collect')}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgingBuckets({ buckets }: { buckets: ArAgingBucketResponseDto[] }) {
  const t = useTranslations('FinancePayment.workspace');

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {buckets.map((bucket) => (
        <div
          key={`${bucket.currency}-${bucket.label}`}
          className="rounded-lg border bg-muted/20 p-3"
        >
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{t(`bucket.${bucket.label}`)}</span>
            <span>{t('installmentCount', { count: bucket.count })}</span>
          </div>
          <p className="mt-2 font-semibold tabular-nums">
            {formatMoney(bucket.amount, bucket.currency)}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProviderRevenueCard({
  report,
}: {
  report: ProviderRevenueReportResponseDto;
}) {
  const t = useTranslations('FinancePayment.workspace');

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center gap-2">
          <Stethoscope
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <CardTitle>{t('providerRevenueTitle')}</CardTitle>
        </div>
        <CardDescription>{t('providerRevenueDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {report.totals.map((total) => (
            <Badge key={total.currency} variant="secondary">
              {formatMoney(total.collected, total.currency)}
            </Badge>
          ))}
        </div>
        {report.lines.length === 0 ? (
          <InlineEmpty label={t('noProviderRevenue')} />
        ) : (
          <div className="space-y-2">
            {report.lines.map((line) => (
              <div
                key={`${line.providerId ?? 'unassigned'}-${line.currency}`}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {line.providerId
                      ? shortId(line.providerId)
                      : t('unassignedProvider')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('collectionCount', { count: line.count })}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(line.collected, line.currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DateField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <CalendarDays
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        {label}
      </span>
      <Input
        className="min-h-11"
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({
  label,
  value,
  destructive = false,
}: {
  label: string;
  value: string;
  destructive?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          destructive
            ? 'mt-1 font-semibold text-destructive tabular-nums'
            : 'mt-1 font-semibold tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  );
}

function Notice({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {label}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-56 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        {label}
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <UsersRound className="size-8" aria-hidden="true" />
        <p>{label}</p>
      </CardContent>
    </Card>
  );
}

function InlineEmpty({ label }: { label: string }) {
  return (
    <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {label}
    </p>
  );
}

function createInitialFilters(): ReportFilters {
  const today = DateTimeManager.create();
  return {
    asOf: DateTimeManager.toDateString(today),
    dateFrom: DateTimeManager.toDateString(
      DateTimeManager.subtractDays(today, 30)
    ),
    dateTo: DateTimeManager.toDateString(today),
  };
}

function isValidRange(filters: ReportFilters): boolean {
  return Boolean(
    filters.asOf &&
    filters.dateFrom &&
    filters.dateTo &&
    filters.dateFrom <= filters.dateTo
  );
}

function decimalRateToPercent(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed * 100)) : 0;
}

function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value / 100);
}

function shortId(value: string): string {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function readAgingReport(value: unknown): ArAgingReportResponseDto {
  if (!isRecord(value)) return emptyAging;

  const buckets = Array.isArray(value.buckets)
    ? value.buckets.filter(isAgingBucket)
    : [];
  const patients = Array.isArray(value.patients)
    ? value.patients.filter(isPatientRisk)
    : [];
  const summaries = Array.isArray(value.summaries)
    ? value.summaries.filter(isAgingSummary)
    : [];

  return {
    clinicId: typeof value.clinicId === 'string' ? value.clinicId : '',
    asOf: typeof value.asOf === 'string' ? value.asOf : '',
    buckets,
    patients,
    summaries,
  };
}

function readPatientLedger(value: unknown): PatientLedgerRow[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): PatientLedgerRow[] => {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      typeof item.category !== 'string' ||
      typeof item.entryDate !== 'string' ||
      typeof item.status !== 'string'
    ) {
      return [];
    }

    return [
      {
        id: item.id,
        category: item.category,
        entryDate: item.entryDate,
        status: item.status,
        description:
          typeof item.description === 'string' ? item.description : null,
        paymentMethod:
          typeof item.paymentMethod === 'string' ? item.paymentMethod : null,
        providerName:
          typeof item.providerName === 'string' ? item.providerName : null,
        ...(typeof item.amount === 'string' ? { amount: item.amount } : {}),
        ...(typeof item.currency === 'string'
          ? { currency: item.currency }
          : {}),
      },
    ];
  });
}

function readRevenueReport(value: unknown): ProviderRevenueReportResponseDto {
  if (!isRecord(value)) return emptyRevenue;

  const lines = Array.isArray(value.lines)
    ? value.lines.filter(
        (line) =>
          isRecord(line) &&
          (line.providerId === null || typeof line.providerId === 'string') &&
          typeof line.currency === 'string' &&
          typeof line.collected === 'string' &&
          typeof line.count === 'number'
      )
    : [];
  const totals = Array.isArray(value.totals)
    ? value.totals.filter(
        (total) =>
          isRecord(total) &&
          typeof total.currency === 'string' &&
          typeof total.collected === 'string'
      )
    : [];

  return {
    clinicId: typeof value.clinicId === 'string' ? value.clinicId : '',
    dateFrom: typeof value.dateFrom === 'string' ? value.dateFrom : null,
    dateTo: typeof value.dateTo === 'string' ? value.dateTo : null,
    lines: lines as ProviderRevenueReportResponseDto['lines'],
    totals: totals as ProviderRevenueReportResponseDto['totals'],
  };
}

function isAgingBucket(value: unknown): value is ArAgingBucketResponseDto {
  return (
    isRecord(value) &&
    typeof value.label === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.count === 'number' &&
    typeof value.amount === 'string'
  );
}

function isPatientRisk(value: unknown): value is ArAgingPatientRiskResponseDto {
  return (
    isRecord(value) &&
    typeof value.patientId === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.outstanding === 'string' &&
    typeof value.overdue === 'string' &&
    (value.oldestDueDate === null || typeof value.oldestDueDate === 'string')
  );
}

function isAgingSummary(value: unknown): value is ArAgingSummaryResponseDto {
  return (
    isRecord(value) &&
    typeof value.currency === 'string' &&
    typeof value.totalOutstanding === 'string' &&
    typeof value.totalOverdue === 'string' &&
    typeof value.totalCollected === 'string' &&
    typeof value.collectionRate === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function createDemoAging(
  asOf: string,
  collection: CollectionFeedback | null
): ArAgingReportResponseDto {
  const buckets: ArAgingBucketResponseDto[] = [
    { label: 'NOT_DUE', currency: 'TRY', count: 8, amount: '184500.00' },
    { label: 'D0_30', currency: 'TRY', count: 4, amount: '76250.00' },
    { label: 'D31_60', currency: 'TRY', count: 2, amount: '31500.00' },
    { label: 'D61_90', currency: 'TRY', count: 1, amount: '12800.00' },
    { label: 'D90_PLUS', currency: 'TRY', count: 1, amount: '9000.00' },
  ];
  const today = DateTimeManager.create(asOf);
  const patients: ArAgingPatientRiskResponseDto[] = [
    {
      patientId: 'demo-patient-1',
      currency: 'TRY',
      outstanding: '82500.00',
      overdue: '42500.00',
      oldestDueDate: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(today, 47)
      ),
    },
    {
      patientId: 'demo-patient-2',
      currency: 'TRY',
      outstanding: '54000.00',
      overdue: '23000.00',
      oldestDueDate: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(today, 19)
      ),
    },
    {
      patientId: 'demo-patient-3',
      currency: 'TRY',
      outstanding: '36000.00',
      overdue: '9000.00',
      oldestDueDate: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(today, 96)
      ),
    },
  ];
  const collectedTry =
    482300 + (collection?.currency === 'TRY' ? collection.amount : 0);
  const summaries: ArAgingSummaryResponseDto[] = [
    {
      currency: 'TRY',
      totalOutstanding: '314050.00',
      totalOverdue: '129550.00',
      totalCollected: collectedTry.toFixed(2),
      collectionRate: (collectedTry / (collectedTry + 314050)).toFixed(4),
    },
  ];
  if (collection && collection.currency !== 'TRY') {
    summaries.push({
      currency: collection.currency,
      totalOutstanding: '0.00',
      totalOverdue: '0.00',
      totalCollected: collection.amount.toFixed(2),
      collectionRate: '1.0000',
    });
  }

  return {
    clinicId: 'clinic_fethiye',
    asOf,
    buckets,
    patients,
    summaries,
  };
}

function createDemoRevenue(
  dateFrom: string,
  dateTo: string
): ProviderRevenueReportResponseDto {
  return {
    clinicId: 'clinic_fethiye',
    dateFrom,
    dateTo,
    lines: [
      {
        providerId: 'dr-ayse-yilmaz',
        currency: 'TRY',
        collected: '214500.00',
        count: 18,
      },
      {
        providerId: 'dr-mehmet-kaya',
        currency: 'TRY',
        collected: '176800.00',
        count: 14,
      },
      { providerId: null, currency: 'TRY', collected: '91000.00', count: 7 },
    ],
    totals: [{ currency: 'TRY', collected: '482300.00' }],
  };
}

function createDemoPatientLedger(patientId: string): PatientLedgerRow[] {
  if (!patientId) return [];

  const today = DateTimeManager.create();
  const common = {
    description: null,
    providerName: 'Dr. Ayşe Yılmaz',
    currency: 'TRY',
  };

  return [
    {
      ...common,
      id: `${patientId}-ledger-1`,
      category: 'TREATMENT_PAYMENT',
      entryDate: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(today, 2)
      ),
      status: 'COMPLETED',
      paymentMethod: 'CREDIT_CARD',
      amount: '25000.00',
    },
    {
      ...common,
      id: `${patientId}-ledger-2`,
      category: 'SERVICE_CHARGE',
      entryDate: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(today, 12)
      ),
      status: 'COMPLETED',
      paymentMethod: null,
      amount: '42000.00',
    },
    {
      ...common,
      id: `${patientId}-ledger-3`,
      category: 'REFUND',
      entryDate: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(today, 21)
      ),
      status: 'REFUNDED',
      paymentMethod: 'CREDIT_CARD',
      amount: '3500.00',
    },
  ];
}

const demoParties: PartyResponseDto[] = [
  createDemoParty(
    'demo-party-1',
    'demo-patient-1',
    'Elif Karaca',
    '+905551112233'
  ),
  createDemoParty(
    'demo-party-2',
    'demo-patient-2',
    'Mert Aydın',
    '+905552223344'
  ),
  createDemoParty(
    'demo-party-3',
    'demo-patient-3',
    'Seda Yıldız',
    '+905553334455'
  ),
];

function createDemoParty(
  id: string,
  originId: string,
  name: string,
  phone: string
): PartyResponseDto {
  const timestamp = DateTimeManager.toIsoString(DateTimeManager.create());
  return {
    id,
    clinicId: 'clinic_fethiye',
    organizationId: 'org_demo',
    type: 'INDIVIDUAL',
    roles: ['PATIENT'],
    originType: 'PATIENT',
    originId,
    name,
    phone,
    email: null,
    address: null,
    taxNumber: null,
    taxOffice: null,
    isEInvoiceUser: false,
    eInvoiceMailbox: null,
    receivableAccountId: null,
    payableAccountId: null,
    nationalId: null,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
