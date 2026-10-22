'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { DateTimeManager } from '@shared/common';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  RefreshCw,
  Search,
  Wallet,
} from 'lucide-react';

import { financeLedgerBackfill } from '@/api/generated/finance-ledger-command/finance-ledger-command';
import {
  financeLedgerGetClinicLedger,
  financeLedgerGetClinicSummary,
  financeLedgerGetMismatches,
} from '@/api/generated/finance-ledger-query/finance-ledger-query';
import type {
  FinanceLedgerGetClinicLedgerParams,
  FinanceLedgerResponseDto,
  LedgerCurrencyTotalResponseDto,
  LedgerMismatchResponseDto,
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
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import { formatShortDate } from '@/lib/date-time';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const ledgerQueryRoot = ['finance', 'finance-ledger'] as const;
const pageSize = 20;
const emptyEntries: FinanceLedgerResponseDto[] = [];
const emptyTotals: LedgerCurrencyTotalResponseDto[] = [];
const emptyMismatches: LedgerMismatchResponseDto[] = [];

type DateRange = { from: string; to: string };
type SortColumn = 'entryDate' | 'amount';

export function FinanceLedgerWorkspace() {
  if (mockingEnabled) return <MockFinanceLedger />;

  return (
    <AuthProvider>
      <LiveFinanceLedger />
    </AuthProvider>
  );
}

function MockFinanceLedger() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <FinanceLedgerContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canBackfill
      isDemo
    />
  );
}

function LiveFinanceLedger() {
  const { actor, status } = useAuth();

  return (
    <FinanceLedgerContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canBackfill={actorHasCapability(actor, 'financeledger:create')}
      isDemo={false}
    />
  );
}

function FinanceLedgerContent({
  clinicId,
  status,
  canBackfill,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canBackfill: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceLedger');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [range, setRange] = useState<DateRange>(defaultRange);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('entryDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [backfillConfirmed, setBackfillConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoMismatches, setDemoMismatches] = useState(createDemoMismatches);

  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setPage(1);
    setBackfillConfirmed(false);
    setNotice(null);
  }, [clinicId]);

  const summaryQuery = useQuery({
    queryKey: [...ledgerQueryRoot, 'summary', isDemo, clinicId, range],
    queryFn: ({ signal }) =>
      financeLedgerGetClinicSummary(
        clinicId ?? '',
        { dateFrom: range.from, dateTo: range.to },
        signal
      ),
    enabled: hasScope && validRange && !isDemo,
    retry: false,
  });

  const mismatchParams = {
    clinicId: clinicId ?? '',
    from: toRangeBoundary(range.from, 'start'),
    to: toRangeBoundary(range.to, 'end'),
  };
  const mismatchesQuery = useQuery({
    queryKey: [...ledgerQueryRoot, 'mismatches', isDemo, mismatchParams],
    queryFn: ({ signal }) => financeLedgerGetMismatches(mismatchParams, signal),
    enabled: hasScope && validRange && !isDemo,
    retry: false,
  });

  const ledgerParams: FinanceLedgerGetClinicLedgerParams = {
    page,
    limit: pageSize,
    orderBy: sortDirection,
    orderByColumn: sortColumn,
    ...(appliedSearch
      ? { search: appliedSearch, searchColumn: 'description' }
      : {}),
  };
  const ledgerQuery = useQuery({
    queryKey: [...ledgerQueryRoot, 'entries', isDemo, clinicId, ledgerParams],
    queryFn: ({ signal }) =>
      financeLedgerGetClinicLedger(clinicId ?? '', ledgerParams, signal),
    enabled: hasScope && !isDemo,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const demoSummary = useMemo(() => buildDemoSummary(range), [range]);
  const filteredDemoMismatches = useMemo(
    () =>
      demoMismatches.filter(
        (mismatch) =>
          mismatch.settledAt >= mismatchParams.from &&
          mismatch.settledAt <= mismatchParams.to
      ),
    [demoMismatches, mismatchParams.from, mismatchParams.to]
  );
  const filteredDemoEntries = useMemo(
    () =>
      demoEntries
        .filter(
          (entry) =>
            !appliedSearch ||
            (entry.description ?? '')
              .toLocaleLowerCase(locale)
              .includes(appliedSearch.toLocaleLowerCase(locale))
        )
        .sort((a, b) => compareDemoEntries(a, b, sortColumn, sortDirection)),
    [appliedSearch, locale, sortColumn, sortDirection]
  );

  const totals = isDemo ? demoSummary : summaryQuery.data?.data.totals ?? emptyTotals;
  const mismatches = isDemo
    ? filteredDemoMismatches
    : mismatchesQuery.data?.data ?? emptyMismatches;
  const entries = isDemo
    ? filteredDemoEntries.slice((page - 1) * pageSize, page * pageSize)
    : ledgerQuery.data?.data ?? emptyEntries;
  const pagination = isDemo
    ? {
        total: filteredDemoEntries.length,
        page,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(filteredDemoEntries.length / pageSize)),
      }
    : ledgerQuery.data?.meta?.pagination;

  const backfillMutation = useMutation({
    mutationFn: async () => {
      if (isDemo) return {};
      return financeLedgerBackfill({
        clinicId: clinicId ?? '',
        from: mismatchParams.from,
        to: mismatchParams.to,
      });
    },
    retry: false,
    onSuccess: async () => {
      if (isDemo) {
        setDemoMismatches([]);
      } else {
        await queryClient.invalidateQueries({ queryKey: ledgerQueryRoot });
      }
      setBackfillConfirmed(false);
      setNotice(t('backfillSuccess'));
    },
  });

  const setRangeField = (key: keyof DateRange, value: string) => {
    setRange((current) => ({ ...current, [key]: value }));
    setBackfillConfirmed(false);
    setNotice(null);
  };
  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };
  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const summaryLoading =
    status === 'loading' || (hasScope && !isDemo && summaryQuery.isPending);
  const mismatchesLoading =
    status === 'loading' || (hasScope && !isDemo && mismatchesQuery.isPending);
  const entriesLoading =
    status === 'loading' || (hasScope && !isDemo && ledgerQuery.isPending);

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="size-4" aria-hidden="true" />
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

      {!validRange && <Notice message={t('invalidRange')} error />}
      {(summaryQuery.isError || mismatchesQuery.isError) && (
        <Notice
          message={
            errorMessage(summaryQuery.error) ??
            errorMessage(mismatchesQuery.error) ??
            t('loadError')
          }
          error
        />
      )}
      {backfillMutation.isError && (
        <Notice
          message={errorMessage(backfillMutation.error) ?? t('backfillError')}
          error
        />
      )}
      {notice && <Notice message={notice} />}

      <Card>
        <CardHeader>
          <CardTitle>{t('summaryTitle')}</CardTitle>
          <CardDescription>{t('summaryDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasScope ? (
            <EmptyState
              label={status === 'unauthenticated' ? t('noSession') : t('noClinic')}
            />
          ) : summaryLoading ? (
            <EmptyState label={t('loading')} />
          ) : totals.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {totals.map((total) => (
                <div key={total.currency} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">
                      {total.currency}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('entryCount', { count: total.entryCount })}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{t('income')}</dt>
                      <dd className="tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatDecimal(total.totalIncome, locale)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">{t('expenses')}</dt>
                      <dd className="tabular-nums text-destructive">
                        {formatDecimal(total.totalExpenses, locale)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between border-t pt-1.5 font-medium">
                      <dt>{t('balance')}</dt>
                      <dd className="tabular-nums">
                        {formatDecimal(total.balance, locale)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState label={t('noSummary')} />
          )}
        </CardContent>
      </Card>

      {hasScope && validRange && !mismatchesLoading && (
        <>
          {mismatches.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
              <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
              <div>
                <span className="font-medium">{t('reconciliationClean')}</span>
                <span className="ml-1 text-muted-foreground">
                  {t('reconciliationCleanDescription')}
                </span>
              </div>
            </div>
          ) : (
            <Card className="border-amber-500/40">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="mt-0.5 size-5 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                  <div>
                    <CardTitle>{t('reconcileTitle')}</CardTitle>
                    <CardDescription>
                      {t('reconcileDescription', { count: mismatches.length })}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">
                          {t('mismatchKind')}
                        </th>
                        <th className="pb-2 pr-3 font-medium">
                          {t('mismatchPatient')}
                        </th>
                        <th className="pb-2 pr-3 font-medium">
                          {t('mismatchSettledAt')}
                        </th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          {t('columnAmount')}
                        </th>
                        <th className="pb-2 pr-3 font-medium">
                          {t('mismatchExpectedStatus')}
                        </th>
                        <th className="pb-2 font-medium">
                          {t('mismatchLedgerStatus')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mismatches.map((mismatch) => (
                        <tr
                          key={mismatch.installmentId}
                          className="border-b last:border-0"
                        >
                          <td className="py-2.5 pr-3">{mismatch.kind}</td>
                          <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                            {truncateId(mismatch.patientId)}
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                            {formatShortDate(mismatch.settledAt, locale)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatDecimal(mismatch.amount, locale)}{' '}
                            {mismatch.currency}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline">
                              {t(`status.${mismatch.expectedStatus}`)}
                            </Badge>
                          </td>
                          <td className="py-2.5">
                            {mismatch.ledgerStatus ? (
                              <Badge variant="outline">
                                {t(`status.${mismatch.ledgerStatus}`)}
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                {t('mismatchMissing')}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canBackfill && (
                  <>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        className="mt-0.5 size-4"
                        type="checkbox"
                        checked={backfillConfirmed}
                        onChange={(event) =>
                          setBackfillConfirmed(event.target.checked)
                        }
                        disabled={backfillMutation.isPending}
                      />
                      <span>
                        <span className="block font-medium">
                          {t('reconcileConfirm')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('reconcileWarning')}
                        </span>
                      </span>
                    </label>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => backfillMutation.mutate()}
                        disabled={!backfillConfirmed || backfillMutation.isPending}
                      >
                        <RefreshCw className="size-4" aria-hidden="true" />
                        {backfillMutation.isPending
                          ? t('backfilling')
                          : t('backfill')}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>
              {pagination
                ? `${t('listDescription')} · ${pagination.total}`
                : t('listDescription')}
            </CardDescription>
          </div>
          <form className="flex w-full gap-2 lg:w-auto" onSubmit={applySearch}>
            <Input
              className="min-w-0 sm:w-72"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              disabled={!hasScope}
            />
            <Button type="submit" variant="outline" disabled={!hasScope}>
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('search')}</span>
            </Button>
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sortColumn === 'entryDate' ? 'default' : 'outline'}
              onClick={() => toggleSort('entryDate')}
              disabled={!hasScope}
            >
              {sortColumn === 'entryDate' && sortDirection === 'asc' ? (
                <ArrowUpAZ className="size-4" aria-hidden="true" />
              ) : (
                <ArrowDownAZ className="size-4" aria-hidden="true" />
              )}
              {t('sortEntryDate')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortColumn === 'amount' ? 'default' : 'outline'}
              onClick={() => toggleSort('amount')}
              disabled={!hasScope}
            >
              {sortColumn === 'amount' && sortDirection === 'asc' ? (
                <ArrowUpAZ className="size-4" aria-hidden="true" />
              ) : (
                <ArrowDownAZ className="size-4" aria-hidden="true" />
              )}
              {t('sortAmount')}
            </Button>
          </div>

          {!hasScope ? (
            <EmptyState
              label={status === 'unauthenticated' ? t('noSession') : t('noClinic')}
            />
          ) : entriesLoading ? (
            <EmptyState label={t('loading')} />
          ) : entries.length === 0 ? (
            <EmptyState label={appliedSearch ? t('noResults') : t('empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">{t('columnDate')}</th>
                    <th className="pb-2 pr-3 font-medium">{t('columnType')}</th>
                    <th className="pb-2 pr-3 font-medium">
                      {t('columnCategory')}
                    </th>
                    <th className="pb-2 pr-3 font-medium">{t('columnSource')}</th>
                    <th className="pb-2 pr-3 font-medium">{t('columnStatus')}</th>
                    <th className="pb-2 pr-3 font-medium">
                      {t('columnDescription')}
                    </th>
                    <th className="pb-2 pr-3 font-medium">
                      {t('columnPatient')}
                    </th>
                    <th className="pb-2 pr-3 text-right font-medium">
                      {t('columnAmount')}
                    </th>
                    <th className="pb-2 text-right font-medium">
                      {t('columnTax')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(entry.entryDate, locale)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant={
                            entry.type === 'INCOME' ? 'secondary' : 'outline'
                          }
                        >
                          {t(`type.${entry.type}`)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {t(`category.${entry.category}`)}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {t(`source.${entry.source}`)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge
                          variant={
                            entry.status === 'COMPLETED' ? 'secondary' : 'outline'
                          }
                        >
                          {t(`status.${entry.status}`)}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 max-w-56 truncate">
                        {entry.description || (
                          <span className="text-muted-foreground">
                            {t('noDescription')}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                        {entry.patientId ? (
                          truncateId(entry.patientId)
                        ) : (
                          t('noPatient')
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">
                        {formatAmount(entry.amount, locale)} {entry.currency}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {formatAmount(entry.taxAmount, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasScope && !entriesLoading && pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t('page', {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                  {t('previous')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1)
                    )
                  }
                  disabled={page >= pagination.totalPages}
                >
                  {t('next')}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Notice({
  message,
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-emerald-600/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'
      }`}
    >
      {message}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function defaultRange(): DateRange {
  const today = DateTimeManager.create();
  return {
    from: DateTimeManager.toDateString(DateTimeManager.subtractDays(today, 30)),
    to: DateTimeManager.toDateString(today),
  };
}

function toRangeBoundary(value: string, boundary: 'start' | 'end'): string {
  if (!value) return '';
  const localDay = DateTimeManager.fromLocalDateTime(value, '00:00');
  const date =
    boundary === 'start'
      ? DateTimeManager.startOfDay(localDay)
      : DateTimeManager.endOfDay(localDay);
  return DateTimeManager.toIsoString(date);
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(DateTimeManager.create(value));
}

function formatDecimal(value: string | null | undefined, locale: string): string {
  if (value == null || !/^-?\d+(\.\d+)?$/.test(value)) return '—';

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Preserve the API's decimal string: coercing it to Number can lose precision.
  return (formatter.format as (input: string) => string)(value);
}

// `FinanceLedgerResponseDto.amount` is a JS number, unlike the decimal-string
// contracts elsewhere (documented gap, see frontend-api-endpoint-gaps.md).
function formatAmount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function buildDemoSummary(range: DateRange): LedgerCurrencyTotalResponseDto[] {
  const inRange = range.from <= '2026-10-20' && range.to >= '2026-10-01';
  if (!inRange) return [];

  return [
    {
      currency: 'TRY',
      totalIncome: '186400.00',
      totalExpenses: '42500.00',
      balance: '143900.00',
      entryCount: 24,
    },
    {
      currency: 'EUR',
      totalIncome: '3200.00',
      totalExpenses: '0.00',
      balance: '3200.00',
      entryCount: 2,
    },
  ];
}

function compareDemoEntries(
  a: FinanceLedgerResponseDto,
  b: FinanceLedgerResponseDto,
  column: SortColumn,
  direction: 'asc' | 'desc'
): number {
  const factor = direction === 'asc' ? 1 : -1;
  if (column === 'amount') return (a.amount - b.amount) * factor;
  return (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0) * factor;
}

function demoEntry(
  overrides: Partial<FinanceLedgerResponseDto> & { id: string }
): FinanceLedgerResponseDto {
  return {
    type: 'INCOME',
    source: 'PAYMENT_MODULE',
    category: 'TREATMENT_PAYMENT',
    status: 'COMPLETED',
    organizationId: 'demo-organization',
    clinicId: 'demo-clinic',
    patientId: null,
    description: null,
    documentNo: null,
    entryDate: '2026-10-20T09:00:00.000Z',
    paymentId: null,
    installmentId: null,
    performedById: null,
    currency: 'TRY',
    amount: 0,
    taxRate: 0,
    taxAmount: 0,
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    ...overrides,
  };
}

const demoEntries: FinanceLedgerResponseDto[] = [
  demoEntry({
    id: 'demo-ledger-1',
    patientId: 'demo-patient-1',
    description: 'Tedavi hizmeti tahsilatı',
    entryDate: '2026-10-20T10:15:00.000Z',
    createdAt: '2026-10-20T10:15:01.000Z',
    updatedAt: '2026-10-20T10:15:01.000Z',
    amount: 11800,
    taxRate: 20,
    taxAmount: 1966.67,
    paymentId: 'demo-payment-1',
  }),
  demoEntry({
    id: 'demo-ledger-2',
    type: 'EXPENSE',
    source: 'INVENTORY_MODULE',
    category: 'MATERIAL_PURCHASE',
    description: 'Sarf malzeme alımı',
    entryDate: '2026-10-18T08:30:00.000Z',
    createdAt: '2026-10-18T08:30:01.000Z',
    updatedAt: '2026-10-18T08:30:01.000Z',
    amount: 4200,
    documentNo: 'FTR-2026-00042',
  }),
  demoEntry({
    id: 'demo-ledger-3',
    patientId: 'demo-patient-2',
    description: 'Hasta tahsilatı · kart',
    entryDate: '2026-10-15T14:05:00.000Z',
    createdAt: '2026-10-15T14:05:01.000Z',
    updatedAt: '2026-10-15T14:05:01.000Z',
    currency: 'EUR',
    amount: 3200,
    paymentId: 'demo-payment-2',
  }),
  demoEntry({
    id: 'demo-ledger-4',
    type: 'EXPENSE',
    source: 'MANUAL_ENTRY',
    category: 'RENT',
    status: 'COMPLETED',
    description: 'Ekim ayı kira ödemesi',
    entryDate: '2026-10-05T09:00:00.000Z',
    createdAt: '2026-10-05T09:00:01.000Z',
    updatedAt: '2026-10-05T09:00:01.000Z',
    amount: 38300,
  }),
  demoEntry({
    id: 'demo-ledger-5',
    category: 'REFUND',
    status: 'REFUNDED',
    patientId: 'demo-patient-3',
    description: 'Kısmi iade',
    entryDate: '2026-10-02T11:40:00.000Z',
    createdAt: '2026-10-02T11:40:01.000Z',
    updatedAt: '2026-10-02T11:40:01.000Z',
    amount: 1500,
    paymentId: 'demo-payment-3',
  }),
];

function createDemoMismatches(): LedgerMismatchResponseDto[] {
  return [
    {
      expectedStatus: 'REFUNDED',
      ledgerStatus: 'COMPLETED',
      installmentId: 'demo-installment-1',
      paymentId: 'demo-payment-4',
      clinicId: 'demo-clinic',
      patientId: 'demo-patient-4',
      kind: 'REFUND',
      settledAt: '2026-10-11T00:00:00.000Z',
      amount: '950.00',
      currency: 'TRY',
    },
    {
      expectedStatus: 'COMPLETED',
      ledgerStatus: null,
      installmentId: 'demo-installment-2',
      paymentId: 'demo-payment-5',
      clinicId: 'demo-clinic',
      patientId: 'demo-patient-5',
      kind: 'COLLECTION',
      settledAt: '2026-10-14T00:00:00.000Z',
      amount: '2400.00',
      currency: 'TRY',
    },
  ];
}
