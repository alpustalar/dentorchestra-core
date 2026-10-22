'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  LockKeyhole,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

import {
  accountingPeriodClosePeriod,
  accountingPeriodLockPeriod,
  accountingPeriodOpenPeriod,
  accountingPeriodReopenPeriod,
} from '@/api/generated/accounting-period-command/accounting-period-command';
import {
  accountingPeriodClosingPreview,
  accountingPeriodGetPeriods,
} from '@/api/generated/accounting-period-query/accounting-period-query';
import type {
  AccountingPeriodResponseDto,
  GetYearEndClosingPreviewFilterDtoGrniAccrualsItemDebitAccountCode,
  YearEndClosingPreviewResponseDto,
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
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const periodQueryRoot = ['finance', 'accounting', 'periods'] as const;
const debitAccountCodes = [
  '150',
  '153',
  '253',
  '254',
  '255',
  '260',
  '760',
  '770',
  '740.01',
  '740.02',
  '740.03',
  '740.04',
] as const;

type PeriodAction =
  | { type: 'lock'; periodId: string }
  | { type: 'reopen'; periodId: string };

type AccrualSelection = Record<
  string,
  GetYearEndClosingPreviewFilterDtoGrniAccrualsItemDebitAccountCode
>;

export function AccountingPeriodsWorkspace() {
  if (mockingEnabled) return <MockAccountingPeriods />;

  return (
    <AuthProvider>
      <LiveAccountingPeriods />
    </AuthProvider>
  );
}

function MockAccountingPeriods() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <AccountingPeriodsContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canCreate
      canUpdate
      isDemo
    />
  );
}

function LiveAccountingPeriods() {
  const { actor, status } = useAuth();

  return (
    <AccountingPeriodsContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canCreate={actorHasCapability(actor, 'accountingperiod:create')}
      canUpdate={actorHasCapability(actor, 'accountingperiod:update')}
      isDemo={false}
    />
  );
}

function AccountingPeriodsContent({
  clinicId,
  status,
  canCreate,
  canUpdate,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canCreate: boolean;
  canUpdate: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceAccounting.periods');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [demoPeriods, setDemoPeriods] = useState(createDemoPeriods);
  const [selectedPeriod, setSelectedPeriod] =
    useState<AccountingPeriodResponseDto | null>(null);
  const [selection, setSelection] = useState<AccrualSelection>({});
  const [previewSelection, setPreviewSelection] = useState('');
  const [irreversibleConfirmed, setIrreversibleConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));
  const queryKey = [...periodQueryRoot, isDemo, clinicId] as const;
  const periodsQuery = useQuery({
    queryKey,
    queryFn: () => accountingPeriodGetPeriods({ clinicId: clinicId ?? '' }),
    enabled: hasScope && !isDemo,
    retry: false,
  });
  const periods = isDemo ? demoPeriods : (periodsQuery.data?.data ?? []);

  const refreshPeriods = async () => {
    if (isDemo) return;
    await queryClient.invalidateQueries({ queryKey: periodQueryRoot });
  };

  const openPeriod = useMutation({
    mutationFn: async (periodYear: number) => {
      if (isDemo) return `demo-period-${periodYear}`;
      return accountingPeriodOpenPeriod({
        clinicId: clinicId ?? '',
        year: periodYear,
      });
    },
    retry: false,
    onSuccess: async (_id, periodYear) => {
      if (isDemo) {
        setDemoPeriods((current) => [
          createDemoPeriod(periodYear, clinicId ?? 'demo-clinic'),
          ...current,
        ]);
      } else {
        await refreshPeriods();
      }
      setNotice(t('opened', { year: periodYear }));
      setYear(String(periodYear + 1));
    },
  });

  const lifecycle = useMutation({
    mutationFn: async (action: PeriodAction) => {
      if (isDemo) return;
      if (action.type === 'lock') {
        return accountingPeriodLockPeriod(action.periodId);
      }
      return accountingPeriodReopenPeriod(action.periodId);
    },
    retry: false,
    onSuccess: async (_result, action) => {
      if (isDemo) {
        setDemoPeriods((current) =>
          current.map((period) =>
            period.id === action.periodId
              ? transitionDemoPeriod(period, action.type)
              : period
          )
        );
      } else {
        await refreshPeriods();
      }
      setNotice(t(action.type === 'lock' ? 'locked' : 'reopened'));
    },
  });

  const preview = useMutation({
    mutationFn: async ({
      period,
      accruals,
    }: {
      period: AccountingPeriodResponseDto;
      accruals: ReturnType<typeof serializeSelection>;
    }) => {
      if (isDemo) return { data: createDemoClosingPreview(period) };
      return accountingPeriodClosingPreview(period.id, {
        grniAccruals: accruals,
      });
    },
    retry: false,
    onSuccess: (response, variables) => {
      setSelectedPeriod(variables.period);
      setPreviewSelection(JSON.stringify(variables.accruals));
      setIrreversibleConfirmed(false);
      setNotice(null);
    },
  });

  const closePeriod = useMutation({
    mutationFn: async ({
      period,
      closingPreview,
      accruals,
    }: {
      period: AccountingPeriodResponseDto;
      closingPreview: YearEndClosingPreviewResponseDto;
      accruals: ReturnType<typeof serializeSelection>;
    }) => {
      if (isDemo) return;
      return accountingPeriodClosePeriod(period.id, {
        expectedLastEntryNo: closingPreview.expectedLastEntryNo,
        grniAccruals: accruals,
      });
    },
    retry: false,
    onSuccess: async (_result, variables) => {
      if (isDemo) {
        setDemoPeriods((current) =>
          current.map((period) =>
            period.id === variables.period.id
              ? transitionDemoPeriod(period, 'close')
              : period
          )
        );
      } else {
        await refreshPeriods();
      }
      setSelectedPeriod(null);
      preview.reset();
      setSelection({});
      setNotice(t('closed'));
    },
  });

  const mutationError =
    errorMessage(openPeriod.error) ??
    errorMessage(lifecycle.error) ??
    errorMessage(preview.error) ??
    errorMessage(closePeriod.error);
  const currentSelection = useMemo(
    () => serializeSelection(selection),
    [selection]
  );
  const previewIsStale =
    Boolean(preview.data) &&
    previewSelection !== JSON.stringify(currentSelection);
  const busy =
    openPeriod.isPending ||
    lifecycle.isPending ||
    preview.isPending ||
    closePeriod.isPending;

  const requestPreview = (period: AccountingPeriodResponseDto) => {
    if (selectedPeriod?.id !== period.id) setSelection({});
    const accruals = selectedPeriod?.id === period.id ? currentSelection : [];
    preview.mutate({ period, accruals });
  };

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="size-4" aria-hidden="true" />
            <span>{t('eyebrow')}</span>
            {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {hasScope
              ? t('description')
              : status === 'unauthenticated'
                ? t('noSession')
                : t('noClinic')}
          </p>
        </div>
      </header>

      {(mutationError || periodsQuery.isError) && (
        <Notice
          message={
            mutationError ?? errorMessage(periodsQuery.error) ?? t('loadError')
          }
          isError
        />
      )}
      {notice && <Notice message={notice} />}

      {canCreate && hasScope && (
        <Card>
          <CardHeader>
            <CardTitle>{t('openTitle')}</CardTitle>
            <CardDescription>{t('openDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex max-w-sm items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const parsedYear = Number(year);
                if (
                  !Number.isInteger(parsedYear) ||
                  parsedYear < 2000 ||
                  parsedYear > 2100
                )
                  return;
                setNotice(null);
                openPeriod.mutate(parsedYear);
              }}
            >
              <label className="grid flex-1 gap-1 text-xs font-medium text-muted-foreground">
                {t('year')}
                <Input
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  disabled={busy}
                />
              </label>
              <Button type="submit" disabled={busy || !year}>
                <Plus className="size-4" aria-hidden="true" />
                {t('open')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('listTitle')}</CardTitle>
          <CardDescription>{t('listDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!hasScope ? (
            <EmptyState
              label={
                status === 'unauthenticated' ? t('noSession') : t('noClinic')
              }
            />
          ) : periodsQuery.isPending && !isDemo ? (
            <EmptyState label={t('loading')} />
          ) : periods.length === 0 ? (
            <EmptyState label={t('empty')} />
          ) : (
            <div className="space-y-3">
              {periods.map((period) => (
                <div key={period.id} className="rounded-xl border">
                  <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-muted p-2">
                        <CalendarRange className="size-5" aria-hidden="true" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold">{period.year}</h2>
                          <StatusBadge
                            status={period.status}
                            label={t(`status.${period.status}`)}
                          />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(period.startsAt, locale)} –{' '}
                          {formatDate(period.endsAt, locale)}
                        </p>
                        {period.closedAt && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t('closedAt', {
                              date: formatDate(period.closedAt, locale),
                            })}
                          </p>
                        )}
                      </div>
                    </div>

                    {canUpdate && period.status !== 'CLOSED' && (
                      <div className="flex flex-wrap gap-2">
                        {period.status === 'OPEN' ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              lifecycle.mutate({
                                type: 'lock',
                                periodId: period.id,
                              })
                            }
                            disabled={busy}
                          >
                            <LockKeyhole
                              className="size-4"
                              aria-hidden="true"
                            />
                            {t('lock')}
                          </Button>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() =>
                                lifecycle.mutate({
                                  type: 'reopen',
                                  periodId: period.id,
                                })
                              }
                              disabled={busy}
                            >
                              <RotateCcw
                                className="size-4"
                                aria-hidden="true"
                              />
                              {t('reopen')}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              onClick={() => requestPreview(period)}
                              disabled={busy}
                            >
                              {t('prepareClosing')}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {selectedPeriod?.id === period.id && preview.data?.data && (
                    <ClosingPreview
                      preview={preview.data.data}
                      selection={selection}
                      setSelection={setSelection}
                      previewIsStale={previewIsStale}
                      confirmed={irreversibleConfirmed}
                      setConfirmed={setIrreversibleConfirmed}
                      busy={busy}
                      locale={locale}
                      onRefresh={() => requestPreview(period)}
                      onCancel={() => {
                        setSelectedPeriod(null);
                        preview.reset();
                        setSelection({});
                      }}
                      onClose={() =>
                        closePeriod.mutate({
                          period,
                          closingPreview: preview.data.data,
                          accruals: currentSelection,
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function ClosingPreview({
  preview,
  selection,
  setSelection,
  previewIsStale,
  confirmed,
  setConfirmed,
  busy,
  locale,
  onRefresh,
  onCancel,
  onClose,
}: {
  preview: YearEndClosingPreviewResponseDto;
  selection: AccrualSelection;
  setSelection: React.Dispatch<React.SetStateAction<AccrualSelection>>;
  previewIsStale: boolean;
  confirmed: boolean;
  setConfirmed: (confirmed: boolean) => void;
  busy: boolean;
  locale: string;
  onRefresh: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('FinanceAccounting.periods');

  return (
    <section
      className="space-y-4 border-t bg-muted/20 p-4"
      aria-label={t('previewTitle')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t('previewTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('previewDescription', { count: preview.steps.length })}
          </p>
        </div>
        <Badge variant={preview.canClose ? 'secondary' : 'destructive'}>
          {preview.canClose ? t('ready') : t('blocked')}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          label={t('income')}
          value={formatDecimal(preview.summary.incomeTotal, locale)}
        />
        <Metric
          label={t('expense')}
          value={formatDecimal(preview.summary.expenseTotal, locale)}
        />
        <Metric
          label={t('netResult')}
          value={formatDecimal(preview.summary.netResult, locale)}
        />
        <Metric
          label={t('grni')}
          value={formatDecimal(preview.summary.grniAccrualTotal, locale)}
        />
        <Metric label={t('lastEntry')} value={preview.expectedLastEntryNo} />
      </div>

      {preview.blockers.length > 0 && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          {preview.blockers.map((blocker, index) => (
            <div
              key={`${blocker.code}-${index}`}
              className="flex gap-2 text-sm text-destructive"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <span>{blocker.message}</span>
            </div>
          ))}
        </div>
      )}

      {preview.grniCandidates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold">{t('grniCandidates')}</h4>
            <p className="text-xs text-muted-foreground">
              {t('grniDescription')}
            </p>
          </div>
          {preview.grniCandidates.map((candidate) => {
            const selectedCode = selection[candidate.orderId];
            return (
              <div
                key={candidate.orderId}
                className="grid gap-3 rounded-lg border bg-background p-3 md:grid-cols-[1fr_auto_auto] md:items-center"
              >
                <label className="flex items-start gap-2 text-sm">
                  <input
                    className="mt-1 size-4"
                    type="checkbox"
                    checked={Boolean(selectedCode)}
                    disabled={!candidate.accruable || busy}
                    onChange={(event) => {
                      setConfirmed(false);
                      setSelection((current) => {
                        const next = { ...current };
                        if (!event.target.checked)
                          delete next[candidate.orderId];
                        else
                          next[candidate.orderId] = isDebitAccountCode(
                            candidate.suggestedDebitAccountCode
                          )
                            ? candidate.suggestedDebitAccountCode
                            : '770';
                        return next;
                      });
                    }}
                  />
                  <span>
                    <span className="block font-medium">
                      {candidate.orderId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {candidate.currency}{' '}
                      {formatDecimal(candidate.accrualAmount, locale)}
                    </span>
                  </span>
                </label>
                <SelectInput
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm disabled:opacity-50"
                  value={selectedCode ?? ''}
                  disabled={!selectedCode || busy}
                  onChange={(event) => {
                    if (!isDebitAccountCode(event.target.value)) return;
                    setConfirmed(false);
                    setSelection((current) => ({
                      ...current,
                      [candidate.orderId]: event.target
                        .value as GetYearEndClosingPreviewFilterDtoGrniAccrualsItemDebitAccountCode,
                    }));
                  }}
                  aria-label={t('debitAccount')}
                >
                  {debitAccountCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </SelectInput>
                {!candidate.accruable && (
                  <Badge variant="destructive">{t('notAccruable')}</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}

      {previewIsStale && <Notice message={t('previewStale')} isError />}

      <label className="flex items-start gap-2 rounded-lg border bg-background p-3 text-sm">
        <input
          className="mt-0.5 size-4"
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          disabled={!preview.canClose || previewIsStale || busy}
        />
        <span>
          <span className="block font-medium">{t('confirmClosing')}</span>
          <span className="text-xs text-muted-foreground">
            {t('irreversible')}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
        >
          {t('cancel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={busy}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t('refreshPreview')}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={onClose}
          disabled={!preview.canClose || previewIsStale || !confirmed || busy}
        >
          {t('closePermanently')}
        </Button>
      </div>
    </section>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: AccountingPeriodResponseDto['status'];
  label: string;
}) {
  return (
    <Badge
      variant={
        status === 'OPEN'
          ? 'secondary'
          : status === 'LOCKED'
            ? 'outline'
            : 'default'
      }
    >
      {label}
    </Badge>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Notice({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={
        isError
          ? 'flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive'
          : 'flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'
      }
    >
      {isError ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{message}</span>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function serializeSelection(selection: AccrualSelection) {
  return Object.entries(selection)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([orderId, debitAccountCode]) => ({ orderId, debitAccountCode }));
}

function isDebitAccountCode(
  value: string | null
): value is GetYearEndClosingPreviewFilterDtoGrniAccrualsItemDebitAccountCode {
  return Boolean(
    value && (debitAccountCodes as readonly string[]).includes(value)
  );
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatDecimal(value: string, locale: string): string {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return '—';
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (formatter.format as (input: string) => string)(value);
}

function createDemoPeriods(): AccountingPeriodResponseDto[] {
  return [
    createDemoPeriod(2026, 'demo-clinic'),
    {
      ...createDemoPeriod(2025, 'demo-clinic'),
      status: 'CLOSED',
      closedAt: '2026-01-15T12:00:00.000Z',
      closedById: 'demo-user',
    },
  ];
}

function createDemoPeriod(
  year: number,
  clinicId: string
): AccountingPeriodResponseDto {
  return {
    id: `demo-period-${year}`,
    clinicId,
    organizationId: 'demo-organization',
    year,
    status: 'OPEN',
    startsAt: `${year}-01-01T00:00:00.000Z`,
    endsAt: `${year}-12-31T23:59:59.999Z`,
    lockedAt: null,
    lockedById: null,
    reopenedAt: null,
    reopenedById: null,
    closedAt: null,
    closedById: null,
    createdAt: `${year}-01-01T00:00:00.000Z`,
    updatedAt: `${year}-01-01T00:00:00.000Z`,
  };
}

function transitionDemoPeriod(
  period: AccountingPeriodResponseDto,
  action: 'lock' | 'reopen' | 'close'
): AccountingPeriodResponseDto {
  const now = new Date().toISOString();
  if (action === 'lock')
    return {
      ...period,
      status: 'LOCKED',
      lockedAt: now,
      lockedById: 'demo-user',
    };
  if (action === 'close')
    return {
      ...period,
      status: 'CLOSED',
      closedAt: now,
      closedById: 'demo-user',
    };
  return {
    ...period,
    status: 'OPEN',
    reopenedAt: now,
    reopenedById: 'demo-user',
  };
}

function createDemoClosingPreview(
  period: AccountingPeriodResponseDto
): YearEndClosingPreviewResponseDto {
  return {
    periodStatus: period.status,
    periodId: period.id,
    clinicId: period.clinicId,
    year: period.year,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    expectedLastEntryNo: '42',
    summary: {
      resultAccountCode: '590',
      incomeTotal: '975000.00',
      expenseTotal: '640000.00',
      netResult: '335000.00',
      reflectedCostTotal: '180000.00',
      grniAccrualTotal: '0.00',
    },
    steps: [],
    grniCandidates: [],
    blockers: [],
    warnings: {
      periodNotEnded: false,
      invoicedNotReceived: [],
      unselectedGrniOrderIds: [],
    },
    canClose: true,
  };
}
