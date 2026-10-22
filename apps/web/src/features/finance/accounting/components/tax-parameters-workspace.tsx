'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarClock, Percent, Plus } from 'lucide-react';

import { taxParameterSet } from '@/api/generated/tax-parameter-command/tax-parameter-command';
import { taxParameterList } from '@/api/generated/tax-parameter-query/tax-parameter-query';
import type {
  SetTaxParameterDtoKey,
  TaxParameterResponseDto,
  TaxParameterResponseDtoKey,
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
const taxQueryRoot = ['finance', 'accounting', 'tax-parameters'] as const;
const taxKeys = [
  'VAT_HEALTH',
  'VAT_STANDARD',
  'VAT_REDUCED',
  'WHT_SELF_EMPLOYMENT',
  'WHT_RENT',
  'CORP_TAX',
] as const satisfies readonly TaxParameterResponseDtoKey[];
const vatKeys = new Set<TaxParameterResponseDtoKey>([
  'VAT_HEALTH',
  'VAT_STANDARD',
  'VAT_REDUCED',
]);
const statutoryVatRates = [0, 1, 10, 20] as const;
const emptyParameters: TaxParameterResponseDto[] = [];

export function TaxParametersWorkspace() {
  if (mockingEnabled) return <MockTaxParameters />;

  return (
    <AuthProvider>
      <LiveTaxParameters />
    </AuthProvider>
  );
}

function MockTaxParameters() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <TaxParametersContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canUpdate
      isDemo
    />
  );
}

function LiveTaxParameters() {
  const { actor, status } = useAuth();

  return (
    <TaxParametersContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canUpdate={actorHasCapability(actor, 'taxparameter:update')}
      isDemo={false}
    />
  );
}

function TaxParametersContent({
  clinicId,
  status,
  canUpdate,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canUpdate: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceAccounting.taxParameters');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [demoParameters, setDemoParameters] = useState(createDemoParameters);
  const [selectedKey, setSelectedKey] =
    useState<TaxParameterResponseDtoKey>('VAT_HEALTH');
  const [rate, setRate] = useState('10');
  const [validFrom, setValidFrom] = useState(() => toLocalDateTime(new Date()));
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  const parametersQuery = useQuery({
    queryKey: [...taxQueryRoot, clinicId],
    queryFn: ({ signal }) => taxParameterList(signal),
    enabled: hasScope && !isDemo,
    retry: false,
  });
  const parameters = isDemo
    ? demoParameters
    : (parametersQuery.data?.data ?? emptyParameters);
  const orderedParameters = useMemo(
    () =>
      [...parameters].sort(
        (left, right) =>
          taxKeys.indexOf(left.key) - taxKeys.indexOf(right.key) ||
          new Date(right.validFrom).getTime() -
            new Date(left.validFrom).getTime()
      ),
    [parameters]
  );
  const currentByKey = useMemo(() => {
    const now = Date.now();
    return new Map(
      taxKeys.map((key) => [
        key,
        parameters.find(
          (parameter) =>
            parameter.key === key &&
            new Date(parameter.validFrom).getTime() <= now &&
            (!parameter.validTo || new Date(parameter.validTo).getTime() > now)
        ) ?? null,
      ])
    );
  }, [parameters]);

  const setParameter = useMutation({
    mutationFn: async ({
      key,
      nextRate,
      effectiveAt,
    }: {
      key: TaxParameterResponseDtoKey;
      nextRate: number;
      effectiveAt: string;
    }) => {
      if (isDemo) return `demo-tax-${key}-${Date.now()}`;
      return taxParameterSet({
        key: key as SetTaxParameterDtoKey,
        rate: nextRate,
        validFrom: effectiveAt,
      });
    },
    retry: false,
    onSuccess: async (id, variables) => {
      if (isDemo) {
        setDemoParameters((current) =>
          addDemoParameterVersion(current, {
            id,
            clinicId: clinicId ?? 'demo-clinic',
            key: variables.key,
            rate: variables.nextRate,
            validFrom: variables.effectiveAt,
          })
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: taxQueryRoot });
      }
      setNotice(t('saved', { key: t(`key.${variables.key}`) }));
      setValidationError(null);
      setValidFrom(toLocalDateTime(new Date()));
    },
  });

  const selectKey = (key: TaxParameterResponseDtoKey) => {
    setSelectedKey(key);
    setRate(currentByKey.get(key)?.rate ?? defaultRateFor(key));
    setValidationError(null);
    setNotice(null);
  };

  const submit = () => {
    const nextRate = Number(rate);
    const effectiveDate = new Date(validFrom);
    const now = new Date();
    now.setSeconds(0, 0);

    if (!Number.isFinite(nextRate) || nextRate < 0 || nextRate > 100) {
      setValidationError(t('invalidRate'));
      return;
    }
    if (Math.abs(nextRate * 100 - Math.round(nextRate * 100)) > 1e-9) {
      setValidationError(t('ratePrecision'));
      return;
    }
    if (
      vatKeys.has(selectedKey) &&
      !statutoryVatRates.includes(
        nextRate as (typeof statutoryVatRates)[number]
      )
    ) {
      setValidationError(t('invalidVatRate'));
      return;
    }
    if (Number.isNaN(effectiveDate.getTime()) || effectiveDate < now) {
      setValidationError(t('invalidDate'));
      return;
    }

    setNotice(null);
    setValidationError(null);
    setParameter.mutate({
      key: selectedKey,
      nextRate,
      effectiveAt: effectiveDate.toISOString(),
    });
  };

  const isLoading =
    status === 'loading' || (hasScope && !isDemo && parametersQuery.isPending);

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Percent className="size-4" aria-hidden="true" />
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

      {parametersQuery.isError && (
        <Notice
          message={errorMessage(parametersQuery.error) ?? t('loadError')}
          error
        />
      )}
      {setParameter.isError && (
        <Notice
          message={errorMessage(setParameter.error) ?? t('saveError')}
          error
        />
      )}
      {validationError && <Notice message={validationError} error />}
      {notice && <Notice message={notice} />}

      {hasScope && !isLoading && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {taxKeys.map((key) => {
            const current = currentByKey.get(key);
            const upcoming = parameters.filter(
              (parameter) =>
                parameter.key === key &&
                new Date(parameter.validFrom).getTime() > Date.now()
            ).length;

            return (
              <button
                key={key}
                type="button"
                onClick={() => selectKey(key)}
                className={`rounded-xl border p-4 text-left transition-colors hover:bg-muted/40 ${
                  selectedKey === key ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{t(`key.${key}`)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {current
                        ? t('effectiveSince', {
                            date: formatDate(current.validFrom, locale),
                          })
                        : t('notConfigured')}
                    </p>
                  </div>
                  <span className="text-2xl font-semibold tabular-nums">
                    {current ? `%${formatRate(current.rate, locale)}` : '—'}
                  </span>
                </div>
                {upcoming > 0 && (
                  <Badge className="mt-3" variant="outline">
                    {t('upcomingCount', { count: upcoming })}
                  </Badge>
                )}
              </button>
            );
          })}
        </section>
      )}

      {canUpdate && hasScope && (
        <Card>
          <CardHeader>
            <CardTitle>{t('newVersionTitle')}</CardTitle>
            <CardDescription>{t('newVersionDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_240px_auto] md:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="grid gap-1.5 text-sm font-medium">
                {t('parameter')}
                <SelectInput
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedKey}
                  onChange={(event) =>
                    selectKey(event.target.value as TaxParameterResponseDtoKey)
                  }
                  disabled={setParameter.isPending}
                >
                  {taxKeys.map((key) => (
                    <option key={key} value={key}>
                      {t(`key.${key}`)}
                    </option>
                  ))}
                </SelectInput>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {t('rate')}
                {vatKeys.has(selectedKey) ? (
                  <SelectInput
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    disabled={setParameter.isPending}
                  >
                    {statutoryVatRates.map((value) => (
                      <option key={value} value={value}>
                        %{value}
                      </option>
                    ))}
                  </SelectInput>
                ) : (
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    disabled={setParameter.isPending}
                  />
                )}
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                {t('validFrom')}
                <Input
                  type="datetime-local"
                  min={toLocalDateTime(new Date())}
                  value={validFrom}
                  onChange={(event) => setValidFrom(event.target.value)}
                  disabled={setParameter.isPending}
                />
              </label>
              <Button type="submit" disabled={setParameter.isPending}>
                <Plus className="size-4" aria-hidden="true" />
                {setParameter.isPending ? t('saving') : t('save')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('historyTitle')}</CardTitle>
          <CardDescription>{t('historyDescription')}</CardDescription>
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
          ) : orderedParameters.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">{t('parameter')}</th>
                    <th className="pb-3 text-right font-medium">{t('rate')}</th>
                    <th className="pb-3 font-medium">{t('validFrom')}</th>
                    <th className="pb-3 font-medium">{t('validTo')}</th>
                    <th className="pb-3 text-right font-medium">
                      {t('status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderedParameters.map((parameter) => {
                    const versionStatus = getVersionStatus(parameter);
                    return (
                      <tr key={parameter.id} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium">
                          {t(`key.${parameter.key}`)}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium tabular-nums">
                          %{formatRate(parameter.rate, locale)}
                        </td>
                        <td className="py-3 pr-4">
                          {formatDateTime(parameter.validFrom, locale)}
                        </td>
                        <td className="py-3 pr-4">
                          {parameter.validTo
                            ? formatDateTime(parameter.validTo, locale)
                            : '—'}
                        </td>
                        <td className="py-3 text-right">
                          <Badge
                            variant={
                              versionStatus === 'CURRENT'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {t(`versionStatus.${versionStatus}`)}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label={t('empty')} />
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{t('historyNote')}</span>
      </div>
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

function getVersionStatus(parameter: TaxParameterResponseDto) {
  const now = Date.now();
  if (new Date(parameter.validFrom).getTime() > now) return 'UPCOMING' as const;
  if (parameter.validTo && new Date(parameter.validTo).getTime() <= now) {
    return 'HISTORICAL' as const;
  }
  return 'CURRENT' as const;
}

function toLocalDateTime(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(value)
  );
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatRate(value: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function defaultRateFor(key: TaxParameterResponseDtoKey): string {
  const defaults: Record<TaxParameterResponseDtoKey, string> = {
    VAT_HEALTH: '10',
    VAT_STANDARD: '20',
    VAT_REDUCED: '1',
    WHT_SELF_EMPLOYMENT: '20',
    WHT_RENT: '20',
    CORP_TAX: '25',
  };
  return defaults[key];
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

function createDemoParameters(): TaxParameterResponseDto[] {
  return taxKeys.map((key, index) => ({
    id: `demo-tax-${key}`,
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    key,
    rate: defaultRateFor(key),
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: `2026-01-01T00:00:0${index}.000Z`,
  }));
}

function addDemoParameterVersion(
  parameters: TaxParameterResponseDto[],
  input: {
    id: string;
    clinicId: string;
    key: TaxParameterResponseDtoKey;
    rate: number;
    validFrom: string;
  }
): TaxParameterResponseDto[] {
  const now = new Date().toISOString();
  return [
    ...parameters.map((parameter) =>
      parameter.key === input.key && parameter.validTo === null
        ? { ...parameter, validTo: input.validFrom, updatedAt: now }
        : parameter
    ),
    {
      id: input.id,
      clinicId: input.clinicId,
      organizationId: 'demo-organization',
      key: input.key,
      rate: input.rate.toFixed(2),
      validFrom: input.validFrom,
      validTo: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
