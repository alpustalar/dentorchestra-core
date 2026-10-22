'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { AlertTriangle, BookOpen, CheckCircle2, Plus } from 'lucide-react';

import { chartOfAccountsInitialize } from '@/api/generated/chart-of-accounts-command/chart-of-accounts-command';
import {
  chartOfAccountsDrift,
  chartOfAccountsList,
} from '@/api/generated/chart-of-accounts-query/chart-of-accounts-query';
import type { AccountResponseDto } from '@/api/generated/model';
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
const chartQueryRoot = ['finance', 'accounting', 'chart-of-accounts'] as const;
const emptyAccounts: AccountResponseDto[] = [];

type AccountTypeFilter = AccountResponseDto['type'] | 'ALL';

type ChartDriftField = {
  field: string;
  expected: string;
  actual: string;
};

type ChartDriftReport = {
  clinicId: string;
  missingCodes: string[];
  extraCodes: string[];
  drifted: Array<{
    code: string;
    accountId: string;
    fields: ChartDriftField[];
  }>;
};

export function ChartOfAccountsWorkspace() {
  if (mockingEnabled) return <MockChartOfAccounts />;

  return (
    <AuthProvider>
      <LiveChartOfAccounts />
    </AuthProvider>
  );
}

function MockChartOfAccounts() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <ChartOfAccountsContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canInitialize
      isDemo
    />
  );
}

function LiveChartOfAccounts() {
  const { actor, status } = useAuth();

  return (
    <ChartOfAccountsContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canInitialize={actorHasCapability(actor, 'account:create')}
      isDemo={false}
    />
  );
}

function ChartOfAccountsContent({
  clinicId,
  status,
  canInitialize,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canInitialize: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceAccounting.chart');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<AccountTypeFilter>('ALL');
  const [notice, setNotice] = useState<string | null>(null);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));
  const params = { clinicId: clinicId ?? '' };

  const accountsQuery = useQuery({
    queryKey: [...chartQueryRoot, 'list', isDemo, clinicId],
    queryFn: () =>
      isDemo ? { data: demoAccounts } : chartOfAccountsList(params),
    enabled: hasScope,
    retry: false,
  });
  const driftQuery = useQuery({
    queryKey: [...chartQueryRoot, 'drift', isDemo, clinicId],
    queryFn: () =>
      isDemo ? demoDrift : chartOfAccountsDrift(params).then(parseDriftReport),
    enabled: hasScope,
    retry: false,
  });
  const initialize = useMutation({
    mutationFn: () => chartOfAccountsInitialize(params),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chartQueryRoot });
      setNotice(t('initialized'));
    },
  });

  const accounts = accountsQuery.data?.data ?? emptyAccounts;
  const drift = driftQuery.data ?? null;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          (type === 'ALL' || account.type === type) &&
          (!normalizedSearch ||
            account.code.toLocaleLowerCase().includes(normalizedSearch) ||
            account.name.toLocaleLowerCase().includes(normalizedSearch))
      ),
    [accounts, normalizedSearch, type]
  );
  const accountDepths = useMemo(() => getAccountDepths(accounts), [accounts]);
  const loadError = accountsQuery.error ?? driftQuery.error;
  const isLoading =
    status === 'loading' ||
    (hasScope && (accountsQuery.isPending || driftQuery.isPending));
  const driftCount = drift
    ? drift.missingCodes.length + drift.extraCodes.length + drift.drifted.length
    : 0;

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="size-4" aria-hidden="true" />
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
        {canInitialize &&
          hasScope &&
          !isDemo &&
          Boolean(drift?.missingCodes.length) && (
            <Button
              type="button"
              onClick={() => initialize.mutate()}
              disabled={initialize.isPending}
            >
              <Plus className="size-4" aria-hidden="true" />
              {initialize.isPending ? t('initializing') : t('initialize')}
            </Button>
          )}
      </header>

      {loadError && (
        <Notice message={errorMessage(loadError) ?? t('loadError')} error />
      )}
      {initialize.isError && (
        <Notice
          message={errorMessage(initialize.error) ?? t('initializeError')}
          error
        />
      )}
      {notice && <Notice message={notice} />}

      {hasScope && !isLoading && drift && (
        <DriftSummary report={drift} count={driftCount} />
      )}

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>
              {t('listDescription', { count: accounts.length })}
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Input
              className="sm:w-72"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              disabled={!hasScope}
            />
            <SelectInput
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(event) =>
                setType(event.target.value as AccountTypeFilter)
              }
              aria-label={t('typeFilter')}
              disabled={!hasScope}
            >
              <option value="ALL">{t('allTypes')}</option>
              {(
                ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const
              ).map((accountType) => (
                <option key={accountType} value={accountType}>
                  {t(`type.${accountType}`)}
                </option>
              ))}
            </SelectInput>
          </div>
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
          ) : visibleAccounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">{t('account')}</th>
                    <th className="pb-3 font-medium">{t('accountType')}</th>
                    <th className="pb-3 font-medium">{t('normalSide')}</th>
                    <th className="pb-3 font-medium">{t('currency')}</th>
                    <th className="pb-3 text-right font-medium">
                      {t('properties')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAccounts.map((account) => (
                    <tr key={account.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div
                          className="flex items-center gap-2"
                          style={{
                            paddingInlineStart: `${(accountDepths.get(account.id) ?? 0) * 16}px`,
                          }}
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {account.code}
                          </span>
                          <span className="font-medium">{account.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">{t(`type.${account.type}`)}</td>
                      <td className="py-3 pr-4">
                        {t(`side.${account.normalSide}`)}
                      </td>
                      <td className="py-3 pr-4">{account.currency ?? '—'}</td>
                      <td className="py-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Badge
                            variant={account.isActive ? 'secondary' : 'outline'}
                          >
                            {account.isActive ? t('active') : t('inactive')}
                          </Badge>
                          {account.isPostable && (
                            <Badge variant="outline">{t('postable')}</Badge>
                          )}
                          {account.requiresParty && (
                            <Badge variant="outline">
                              {t('requiresParty')}
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState label={accounts.length ? t('noResults') : t('empty')} />
          )}
        </CardContent>
      </Card>
    </main>
  );

  function DriftSummary({
    report,
    count,
  }: {
    report: ChartDriftReport;
    count: number;
  }) {
    if (count === 0) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-600/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
          {t('inSync')}
        </div>
      );
    }

    return (
      <Card className="border-amber-600/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 size-5 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div>
              <CardTitle>{t('driftTitle', { count })}</CardTitle>
              <CardDescription>{t('driftDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <DriftGroup title={t('missing')} values={report.missingCodes} />
          <DriftGroup title={t('extra')} values={report.extraCodes} />
          <DriftGroup
            title={t('drifted')}
            values={report.drifted.map(
              (row) =>
                `${row.code} · ${row.fields.map((field) => field.field).join(', ')}`
            )}
          />
        </CardContent>
      </Card>
    );
  }
}

function DriftGroup({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-sm font-medium">{title}</p>
      {values.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {values.map((value) => (
            <Badge key={value} variant="outline">
              {value}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">—</p>
      )}
    </div>
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

function parseDriftReport(response: unknown): ChartDriftReport {
  const candidate =
    isRecord(response) && isRecord(response.data) ? response.data : response;
  if (
    !isRecord(candidate) ||
    typeof candidate.clinicId !== 'string' ||
    !isStringArray(candidate.missingCodes) ||
    !isStringArray(candidate.extraCodes) ||
    !Array.isArray(candidate.drifted)
  ) {
    throw new Error('Invalid chart-of-accounts drift response');
  }

  return candidate as ChartDriftReport;
}

function getAccountDepths(accounts: AccountResponseDto[]) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const depths = new Map<string, number>();

  for (const account of accounts) {
    let depth = 0;
    let parentId = account.parentId;
    const visited = new Set<string>();
    while (parentId && byId.has(parentId) && !visited.has(parentId)) {
      visited.add(parentId);
      depth += 1;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    depths.set(account.id, depth);
  }

  return depths;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
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
  if (!isRecord(error) || typeof error.message !== 'string') return null;
  return error.message;
}

const demoAccounts: AccountResponseDto[] = [
  demoAccount('100', 'Kasa', 'ASSET', 'DEBIT'),
  demoAccount('102', 'Bankalar', 'ASSET', 'DEBIT'),
  demoAccount('120', 'Alıcılar', 'ASSET', 'DEBIT', { requiresParty: true }),
  demoAccount('320', 'Satıcılar', 'LIABILITY', 'CREDIT', {
    requiresParty: true,
  }),
  demoAccount('391', 'Hesaplanan KDV', 'LIABILITY', 'CREDIT'),
  demoAccount('600', 'Yurtiçi Satışlar', 'REVENUE', 'CREDIT'),
  demoAccount('770', 'Genel Yönetim Giderleri', 'EXPENSE', 'DEBIT'),
];

const demoDrift: ChartDriftReport = {
  clinicId: 'demo-clinic',
  missingCodes: [],
  extraCodes: [],
  drifted: [],
};

function demoAccount(
  code: string,
  name: string,
  type: AccountResponseDto['type'],
  normalSide: AccountResponseDto['normalSide'],
  overrides: Partial<AccountResponseDto> = {}
): AccountResponseDto {
  return {
    id: `demo-account-${code}`,
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    code,
    name,
    type,
    normalSide,
    parentId: null,
    isActive: true,
    isPostable: true,
    requiresParty: false,
    currency: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}
