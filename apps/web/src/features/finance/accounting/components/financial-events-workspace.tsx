'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateTimeManager } from '@shared/common';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw, Workflow } from 'lucide-react';

import { financialEventPostUnposted } from '@/api/generated/financial-event-command/financial-event-command';
import {
  financialEventGetEvents,
  financialEventGetUnposted,
} from '@/api/generated/financial-event-query/financial-event-query';
import type {
  FinancialEventGetEventsParams,
  FinancialEventResponseDto,
  FinancialEventResponseDtoType,
} from '@/api/generated/model';
import { FinancialEventResponseDtoType as EventTypes } from '@/api/generated/model';
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
const emptyEvents: FinancialEventResponseDto[] = [];

type View = 'unposted' | 'all';
type DateRange = { from: string; to: string };
type PostResult = { posted: number; skipped: number; failed: number };
type RuntimeEventParams = Pick<
  FinancialEventGetEventsParams,
  'clinicId' | 'page' | 'limit' | 'orderBy' | 'orderByColumn'
> & {
  type?: string;
  sourceModule?: string;
  sourceRefId?: string;
};

export function FinancialEventsWorkspace() {
  if (mockingEnabled) return <MockFinancialEvents />;

  return (
    <AuthProvider>
      <LiveFinancialEvents />
    </AuthProvider>
  );
}

function MockFinancialEvents() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <FinancialEventsContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canRetry
      isDemo
    />
  );
}

function LiveFinancialEvents() {
  const { actor, status } = useAuth();

  return (
    <FinancialEventsContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canRetry={actorHasCapability(actor, 'financialevent:update')}
      isDemo={false}
    />
  );
}

function FinancialEventsContent({
  clinicId,
  status,
  canRetry,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canRetry: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceAccounting.events');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('unposted');
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [eventType, setEventType] = useState('ALL');
  const [sourceModule, setSourceModule] = useState('');
  const [sourceRefId, setSourceRefId] = useState('');
  const [page, setPage] = useState(1);
  const [retryConfirmed, setRetryConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoUnposted, setDemoUnposted] = useState(createDemoUnposted);
  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setPage(1);
    setRetryConfirmed(false);
    setNotice(null);
  }, [clinicId]);

  const allRuntimeParams: RuntimeEventParams = {
    clinicId: clinicId ?? '',
    page,
    limit: pageSize,
    orderBy: 'desc',
    orderByColumn: 'occurredAt',
    ...(eventType === 'ALL' ? {} : { type: eventType }),
    ...(sourceModule.trim() ? { sourceModule: sourceModule.trim() } : {}),
    ...(sourceRefId.trim() ? { sourceRefId: sourceRefId.trim() } : {}),
  };
  // OpenAPI marks optional filters as required. Keep absent filters out of the
  // request until the API contract is regenerated.
  const allParams = allRuntimeParams as FinancialEventGetEventsParams;
  const unpostedParams = {
    clinicId: clinicId ?? '',
    from: toRangeBoundary(range.from, 'start'),
    to: toRangeBoundary(range.to, 'end'),
    page,
    limit: pageSize,
    orderBy: 'asc' as const,
    orderByColumn: 'occurredAt',
  };

  const eventsQuery = useQuery({
    queryKey: [
      ...accountingQueryRoot,
      'financial-events',
      isDemo,
      allRuntimeParams,
    ],
    queryFn: ({ signal }) => financialEventGetEvents(allParams, signal),
    enabled: hasScope && !isDemo && view === 'all',
    retry: false,
  });
  const unpostedQuery = useQuery({
    queryKey: [
      ...accountingQueryRoot,
      'unposted-financial-events',
      isDemo,
      unpostedParams,
    ],
    queryFn: ({ signal }) => financialEventGetUnposted(unpostedParams, signal),
    enabled: hasScope && validRange && !isDemo && view === 'unposted',
    retry: false,
  });

  const demoAllEvents = useMemo(
    () => [...demoUnposted, ...demoPostedEvents],
    [demoUnposted]
  );
  const filteredDemoEvents = useMemo(() => {
    const base = view === 'unposted' ? demoUnposted : demoAllEvents;
    return base.filter((event) => {
      const date = event.occurredAt.slice(0, 10);
      const inRange =
        view === 'all' || (date >= range.from && date <= range.to);
      return (
        inRange &&
        (view === 'unposted' ||
          eventType === 'ALL' ||
          event.type === eventType) &&
        (view === 'unposted' ||
          !sourceModule.trim() ||
          event.sourceModule
            .toLocaleLowerCase(locale)
            .includes(sourceModule.trim().toLocaleLowerCase(locale))) &&
        (view === 'unposted' ||
          !sourceRefId.trim() ||
          event.sourceRefId === sourceRefId.trim())
      );
    });
  }, [
    demoAllEvents,
    demoUnposted,
    eventType,
    locale,
    range.from,
    range.to,
    sourceModule,
    sourceRefId,
    view,
  ]);

  const activeQuery = view === 'unposted' ? unpostedQuery : eventsQuery;
  const events = isDemo
    ? filteredDemoEvents.slice((page - 1) * pageSize, page * pageSize)
    : (activeQuery.data?.data ?? emptyEvents);
  const pagination = isDemo
    ? {
        total: filteredDemoEvents.length,
        page,
        limit: pageSize,
        totalPages: Math.max(
          1,
          Math.ceil(filteredDemoEvents.length / pageSize)
        ),
      }
    : activeQuery.data?.meta?.pagination;

  const retryPosting = useMutation({
    mutationFn: async () => {
      if (isDemo) {
        return { posted: demoUnposted.length, skipped: 0, failed: 0 };
      }
      return financialEventPostUnposted({
        clinicId: clinicId ?? '',
        from: toRangeBoundary(range.from, 'start'),
        to: toRangeBoundary(range.to, 'end'),
      }) as Promise<PostResult>;
    },
    retry: false,
    onSuccess: async (result) => {
      if (isDemo) setDemoUnposted([]);
      await queryClient.invalidateQueries({ queryKey: accountingQueryRoot });
      setRetryConfirmed(false);
      setNotice(
        t('retryResult', {
          posted: result.posted,
          skipped: result.skipped,
          failed: result.failed,
        })
      );
    },
  });

  const changeView = (nextView: View) => {
    setView(nextView);
    setPage(1);
    setRetryConfirmed(false);
    setNotice(null);
  };
  const resetPage = () => {
    setPage(1);
    setRetryConfirmed(false);
    setNotice(null);
  };
  const isLoading =
    status === 'loading' || (hasScope && !isDemo && activeQuery.isPending);

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Workflow className="size-4" aria-hidden="true" />
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
      </header>

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={t('views')}
      >
        <Button
          type="button"
          variant={view === 'unposted' ? 'default' : 'outline'}
          onClick={() => changeView('unposted')}
          role="tab"
          aria-selected={view === 'unposted'}
        >
          {t('unposted')}
        </Button>
        <Button
          type="button"
          variant={view === 'all' ? 'default' : 'outline'}
          onClick={() => changeView('all')}
          role="tab"
          aria-selected={view === 'all'}
        >
          {t('allEvents')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
          <CardDescription>
            {view === 'unposted'
              ? t('unpostedFilterDescription')
              : t('allFilterDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {view === 'unposted' && (
            <>
              <DateField
                label={t('from')}
                value={range.from}
                onChange={(from) => {
                  setRange((current) => ({ ...current, from }));
                  resetPage();
                }}
              />
              <DateField
                label={t('to')}
                value={range.to}
                onChange={(to) => {
                  setRange((current) => ({ ...current, to }));
                  resetPage();
                }}
              />
            </>
          )}
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t('eventType')}
            <SelectInput
              className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={eventType}
              onChange={(event) => {
                setEventType(event.target.value);
                resetPage();
              }}
              disabled={!hasScope || view === 'unposted'}
            >
              <option value="ALL">{t('allTypes')}</option>
              {Object.values(EventTypes).map((type) => (
                <option key={type} value={type}>
                  {eventTypeLabel(type, t)}
                </option>
              ))}
            </SelectInput>
          </label>
          <TextField
            label={t('sourceModule')}
            value={sourceModule}
            onChange={(value) => {
              setSourceModule(value);
              resetPage();
            }}
            disabled={!hasScope || view === 'unposted'}
          />
          {view === 'all' && (
            <TextField
              label={t('sourceRef')}
              value={sourceRefId}
              onChange={(value) => {
                setSourceRefId(value);
                resetPage();
              }}
              disabled={!hasScope}
            />
          )}
        </CardContent>
      </Card>

      {!validRange && view === 'unposted' && (
        <Notice message={t('invalidRange')} error />
      )}
      {activeQuery.error && (
        <Notice
          message={errorMessage(activeQuery.error) ?? t('loadError')}
          error
        />
      )}
      {retryPosting.isError && (
        <Notice
          message={errorMessage(retryPosting.error) ?? t('retryError')}
          error
        />
      )}
      {notice && <Notice message={notice} />}

      {view === 'unposted' && canRetry && hasScope && events.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-amber-600"
                aria-hidden="true"
              />
              <div>
                <CardTitle>{t('retryTitle')}</CardTitle>
                <CardDescription>{t('retryDescription')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-2 text-sm">
              <input
                className="mt-0.5 size-4"
                type="checkbox"
                checked={retryConfirmed}
                onChange={(event) => setRetryConfirmed(event.target.checked)}
                disabled={retryPosting.isPending}
              />
              <span>
                <span className="block font-medium">{t('retryConfirm')}</span>
                <span className="text-xs text-muted-foreground">
                  {t('retryWarning')}
                </span>
              </span>
            </label>
            <Button
              type="button"
              onClick={() => retryPosting.mutate()}
              disabled={
                !retryConfirmed || retryPosting.isPending || !validRange
              }
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {retryPosting.isPending ? t('retrying') : t('retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {view === 'unposted' ? t('unpostedList') : t('allList')}
          </CardTitle>
          <CardDescription>
            {t('listDescription', {
              count: pagination?.total ?? events.length,
            })}
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
          ) : events.length ? (
            <div className="space-y-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} locale={locale} t={t} />
              ))}
            </div>
          ) : (
            <EmptyState
              label={view === 'unposted' ? t('noUnposted') : t('empty')}
            />
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

type Translation = ReturnType<
  typeof useTranslations<'FinanceAccounting.events'>
>;

function EventCard({
  event,
  locale,
  t,
}: {
  event: FinancialEventResponseDto;
  locale: string;
  t: Translation;
}) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{eventTypeLabel(event.type, t)}</Badge>
            <Badge variant="outline">{event.sourceModule}</Badge>
          </div>
          <p className="mt-2 font-mono text-sm font-medium">{event.id}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>{formatDateTime(event.occurredAt, locale)}</span>
            {event.sourceRefId && (
              <span>{t('sourceRefValue', { id: event.sourceRefId })}</span>
            )}
            {event.performedById && (
              <span>{t('performedBy', { id: event.performedById })}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {t('recordedAt', { date: formatDateTime(event.createdAt, locale) })}
        </span>
      </div>
      {event.dedupeKey && (
        <p className="mt-3 truncate border-t pt-3 font-mono text-xs text-muted-foreground">
          {t('dedupeKey', { key: event.dedupeKey })}
        </p>
      )}
    </article>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
    </label>
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

function eventTypeLabel(type: FinancialEventResponseDtoType, t: Translation) {
  return t.has(`type.${type}`) ? t(`type.${type}`) : type.replaceAll('_', ' ');
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(DateTimeManager.create(value));
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

function createDemoUnposted(): FinancialEventResponseDto[] {
  return [
    demoEvent(
      'demo-event-unposted-1',
      EventTypes.PURCHASE_INVOICE_RECEIVED,
      'purchase-invoice',
      'demo-purchase-invoice-42'
    ),
    demoEvent(
      'demo-event-unposted-2',
      EventTypes.CASH_SESSION_CLOSED,
      'cash-register',
      'demo-cash-session-18'
    ),
  ];
}

const demoPostedEvents: FinancialEventResponseDto[] = [
  demoEvent(
    'demo-event-posted-1',
    EventTypes.PAYMENT_RECEIVED,
    'payment',
    'demo-payment-71'
  ),
];

function demoEvent(
  id: string,
  type: FinancialEventResponseDtoType,
  sourceModule: string,
  sourceRefId: string
): FinancialEventResponseDto {
  return {
    id,
    type,
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    occurredAt: '2026-10-20T09:30:00.000Z',
    sourceModule,
    sourceRefId,
    performedById: 'demo-accountant',
    createdAt: '2026-10-20T09:30:01.000Z',
    payload: {},
    dedupeKey: `${sourceModule}:${sourceRefId}`,
  };
}
