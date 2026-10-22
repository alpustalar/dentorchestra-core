'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { BookCheck, RotateCcw, ShieldAlert } from 'lucide-react';

import { accountingPeriodGetPeriods } from '@/api/generated/accounting-period-query/accounting-period-query';
import { journalReverse } from '@/api/generated/journal-command/journal-command';
import { journalGetEntries } from '@/api/generated/journal-query/journal-query';
import type {
  AccountingPeriodResponseDto,
  JournalEntryResponseDto,
  JournalEntryResponseDtoStatus,
  JournalGetEntriesParams,
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
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const accountingQueryRoot = ['finance', 'accounting'] as const;
const pageSize = 20;
const emptyEntries: JournalEntryResponseDto[] = [];
const emptyPeriods: AccountingPeriodResponseDto[] = [];

type StatusFilter = JournalEntryResponseDtoStatus | 'ALL';
type RuntimeJournalParams = Omit<
  JournalGetEntriesParams,
  'status' | 'periodId'
> & {
  status?: string;
  periodId?: string;
};

export function AccountingPostingWorkspace() {
  if (mockingEnabled) return <MockAccountingPosting />;

  return (
    <AuthProvider>
      <LiveAccountingPosting />
    </AuthProvider>
  );
}

function MockAccountingPosting() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <AccountingPostingContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canReverse
      isDemo
    />
  );
}

function LiveAccountingPosting() {
  const { actor, status } = useAuth();

  return (
    <AccountingPostingContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canReverse={actorHasCapability(actor, 'journalentry:delete')}
      isDemo={false}
    />
  );
}

function AccountingPostingContent({
  clinicId,
  status,
  canReverse,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canReverse: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceAccounting.posting');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [periodId, setPeriodId] = useState('ALL');
  const [page, setPage] = useState(1);
  const [demoEntries, setDemoEntries] = useState(createDemoEntries);
  const [pendingReversal, setPendingReversal] =
    useState<JournalEntryResponseDto | null>(null);
  const [reversalConfirmed, setReversalConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setPendingReversal(null);
    setReversalConfirmed(false);
    setNotice(null);
    setPage(1);
    setPeriodId('ALL');
  }, [clinicId]);

  const runtimeParams: RuntimeJournalParams = {
    clinicId: clinicId ?? '',
    page,
    limit: pageSize,
    orderBy: 'desc',
    orderByColumn: 'entryDate',
    ...(statusFilter === 'ALL' ? {} : { status: statusFilter }),
    ...(periodId === 'ALL' ? {} : { periodId }),
  };
  // OpenAPI currently marks the backend's optional status/periodId fields as
  // required. Keep them absent at runtime until that contract is regenerated.
  const journalParams = runtimeParams as JournalGetEntriesParams;

  const entriesQuery = useQuery({
    queryKey: [
      ...accountingQueryRoot,
      'journal-entries',
      isDemo,
      runtimeParams,
    ],
    queryFn: ({ signal }) => journalGetEntries(journalParams, signal),
    enabled: hasScope && !isDemo,
    retry: false,
  });
  const periodsQuery = useQuery({
    queryKey: [...accountingQueryRoot, 'periods', isDemo, clinicId],
    queryFn: ({ signal }) =>
      accountingPeriodGetPeriods({ clinicId: clinicId ?? '' }, signal),
    enabled: hasScope && !isDemo,
    retry: false,
  });

  const filteredDemoEntries = useMemo(
    () =>
      demoEntries.filter(
        (entry) =>
          (statusFilter === 'ALL' || entry.status === statusFilter) &&
          (periodId === 'ALL' || entry.periodId === periodId)
      ),
    [demoEntries, periodId, statusFilter]
  );
  const entries = isDemo
    ? filteredDemoEntries.slice((page - 1) * pageSize, page * pageSize)
    : (entriesQuery.data?.data ?? emptyEntries);
  const periods = isDemo
    ? demoPeriods
    : (periodsQuery.data?.data ?? emptyPeriods);
  const pagination = isDemo
    ? {
        total: filteredDemoEntries.length,
        page,
        limit: pageSize,
        totalPages: Math.max(
          1,
          Math.ceil(filteredDemoEntries.length / pageSize)
        ),
      }
    : entriesQuery.data?.meta?.pagination;

  const reverseEntry = useMutation({
    mutationFn: async (entry: JournalEntryResponseDto) => {
      if (isDemo) return `demo-reversal-${entry.id}`;
      return journalReverse(entry.id);
    },
    retry: false,
    onSuccess: async (reversalId, entry) => {
      if (isDemo) {
        setDemoEntries((current) =>
          reverseDemoEntry(current, entry, reversalId)
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: accountingQueryRoot });
      }
      setPendingReversal(null);
      setReversalConfirmed(false);
      setNotice(t('reversed', { entryNo: entry.entryNo ?? t('unassigned') }));
    },
  });

  const changeStatus = (nextStatus: StatusFilter) => {
    setStatusFilter(nextStatus);
    setPage(1);
    setPendingReversal(null);
    setReversalConfirmed(false);
    setNotice(null);
  };
  const changePeriod = (nextPeriodId: string) => {
    setPeriodId(nextPeriodId);
    setPage(1);
    setPendingReversal(null);
    setReversalConfirmed(false);
    setNotice(null);
  };
  const loadError = entriesQuery.error ?? periodsQuery.error;
  const isLoading =
    status === 'loading' ||
    (hasScope && !isDemo && (entriesQuery.isPending || periodsQuery.isPending));

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <BookCheck className="size-4" aria-hidden="true" />
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t('period')}
            <SelectInput
              className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={periodId}
              onChange={(event) => changePeriod(event.target.value)}
              disabled={!hasScope}
            >
              <option value="ALL">{t('allPeriods')}</option>
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.year} · {t(`periodStatus.${period.status}`)}
                </option>
              ))}
            </SelectInput>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t('entryStatus')}
            <SelectInput
              className="h-9 min-w-40 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={statusFilter}
              onChange={(event) =>
                changeStatus(event.target.value as StatusFilter)
              }
              disabled={!hasScope}
            >
              <option value="ALL">{t('allStatuses')}</option>
              <option value="DRAFT">{t('status.DRAFT')}</option>
              <option value="POSTED">{t('status.POSTED')}</option>
              <option value="REVERSED">{t('status.REVERSED')}</option>
            </SelectInput>
          </label>
        </div>
      </header>

      {loadError && (
        <Notice message={errorMessage(loadError) ?? t('loadError')} error />
      )}
      {reverseEntry.isError && (
        <Notice
          message={errorMessage(reverseEntry.error) ?? t('reverseError')}
          error
        />
      )}
      {notice && <Notice message={notice} />}

      {pendingReversal && (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <ShieldAlert
                className="mt-0.5 size-5 shrink-0 text-destructive"
                aria-hidden="true"
              />
              <div>
                <CardTitle>{t('reverseTitle')}</CardTitle>
                <CardDescription>
                  {t('reverseDescription', {
                    entryNo: pendingReversal.entryNo ?? t('unassigned'),
                  })}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {pendingReversal.description || t('noDescription')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(pendingReversal.entryDate, locale)}
              </p>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-0.5 size-4"
                type="checkbox"
                checked={reversalConfirmed}
                onChange={(event) => setReversalConfirmed(event.target.checked)}
                disabled={reverseEntry.isPending}
              />
              <span>
                <span className="block font-medium">{t('reverseConfirm')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('reverseWarning')}
                </span>
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPendingReversal(null);
                  setReversalConfirmed(false);
                }}
                disabled={reverseEntry.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => reverseEntry.mutate(pendingReversal)}
                disabled={!reversalConfirmed || reverseEntry.isPending}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {reverseEntry.isPending ? t('reversing') : t('reverse')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('listTitle')}</CardTitle>
          <CardDescription>
            {pagination
              ? t('listDescription', { count: pagination.total })
              : t('listDescription', { count: entries.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasScope ? (
            <EmptyState
              label={
                status === 'unauthenticated' ? t('noSession') : t('noClinic')
              }
            />
          ) : isLoading ? (
            <EmptyState label={t('loading')} />
          ) : entries.length ? (
            <div className="space-y-3">
              {entries.map((entry) => (
                <article key={entry.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold">
                          {entry.entryNo
                            ? `#${entry.entryNo}`
                            : t('unassigned')}
                        </span>
                        <Badge
                          variant={
                            entry.status === 'POSTED' ? 'secondary' : 'outline'
                          }
                        >
                          {t(`status.${entry.status}`)}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium">
                        {entry.description || t('noDescription')}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDateTime(entry.entryDate, locale)}</span>
                        <span>{t('periodRef', { id: entry.periodId })}</span>
                        {entry.eventId && (
                          <span>{t('eventRef', { id: entry.eventId })}</span>
                        )}
                        {entry.performedById && (
                          <span>
                            {t('performedBy', { id: entry.performedById })}
                          </span>
                        )}
                      </div>
                    </div>
                    {canReverse && entry.status === 'POSTED' && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPendingReversal(entry);
                          setReversalConfirmed(false);
                          setNotice(null);
                        }}
                        disabled={reverseEntry.isPending}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        {t('reverse')}
                      </Button>
                    )}
                  </div>
                  {entry.reversedById && (
                    <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                      {t('reversalRef', { id: entry.reversedById })}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState label={t('empty')} />
          )}

          {hasScope &&
            !isLoading &&
            pagination &&
            pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  {t('page', {
                    page: pagination.page,
                    totalPages: pagination.totalPages,
                  })}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1}
                  >
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
      className={`rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-destructive/40 bg-destructive/5 text-destructive'
          : 'border-emerald-600/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'
      }`}
      role={error ? 'alert' : 'status'}
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

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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

const demoPeriods: AccountingPeriodResponseDto[] = [
  {
    id: 'demo-period-2026',
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    year: 2026,
    status: 'OPEN',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-12-31T23:59:59.999Z',
    lockedAt: null,
    lockedById: null,
    reopenedAt: null,
    reopenedById: null,
    closedAt: null,
    closedById: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-21T00:00:00.000Z',
  },
];

function createDemoEntries(): JournalEntryResponseDto[] {
  return [
    demoEntry('demo-entry-42', '2026-042', 'POSTED', 'Hasta tahsilatı'),
    demoEntry('demo-entry-41', '2026-041', 'POSTED', 'Tedavi hizmeti faturası'),
    demoEntry(
      'demo-entry-40',
      '2026-040',
      'REVERSED',
      'İptal edilen alış faturası',
      {
        reversedById: 'demo-reversal-40',
      }
    ),
    demoEntry(
      'demo-entry-draft',
      null,
      'DRAFT',
      'İşlenmeyi bekleyen finansal olay'
    ),
  ];
}

function demoEntry(
  id: string,
  entryNo: string | null,
  status: JournalEntryResponseDtoStatus,
  description: string,
  overrides: Partial<JournalEntryResponseDto> = {}
): JournalEntryResponseDto {
  return {
    id,
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    periodId: 'demo-period-2026',
    entryNo,
    entryDate: '2026-10-21T09:00:00.000Z',
    description,
    eventId: `demo-event-${id}`,
    reversedById: null,
    performedById: 'demo-accountant',
    status,
    createdAt: '2026-10-21T09:00:00.000Z',
    updatedAt: '2026-10-21T09:00:00.000Z',
    ...overrides,
  };
}

function reverseDemoEntry(
  entries: JournalEntryResponseDto[],
  original: JournalEntryResponseDto,
  reversalId: string
): JournalEntryResponseDto[] {
  const now = new Date().toISOString();
  return [
    demoEntry(
      reversalId,
      '2026-043',
      'POSTED',
      `Storno: ${original.description ?? ''}`,
      {
        eventId: null,
        entryDate: now,
        createdAt: now,
        updatedAt: now,
      }
    ),
    ...entries.map((entry) =>
      entry.id === original.id
        ? {
            ...entry,
            status: 'REVERSED' as const,
            reversedById: reversalId,
            updatedAt: now,
          }
        : entry
    ),
  ];
}
