'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, BookOpenCheck, CircleCheck } from 'lucide-react';

import {
  accountingReportsJournal,
  accountingReportsTrialBalance,
} from '@/api/generated/accounting-reports-query/accounting-reports-query';
import type {
  AccountingReportsJournal200,
  AccountingReportsTrialBalance200,
} from '@/api/generated/model';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import { AuthProvider, useAuth, type AuthStatus } from '@/lib/auth';

type DateRange = { dateFrom: string; dateTo: string };

function currentYearRange(): DateRange {
  const year = new Date().getFullYear();
  return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
}

function isValidRange(range: DateRange): boolean {
  return Boolean(
    range.dateFrom && range.dateTo && range.dateFrom <= range.dateTo
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

function formatDecimal(
  value: string | null | undefined,
  locale: string
): string {
  if (value == null || !/^-?\d+(\.\d+)?$/.test(value)) return '—';

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Preserve the API's decimal string: coercing it to Number can lose precision.
  return (formatter.format as (input: string) => string)(value);
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

export function AccountingWorkspace() {
  if (mockingEnabled) return <MockAccountingReports />;

  return (
    <AuthProvider>
      <LiveAccountingReports />
    </AuthProvider>
  );
}

function MockAccountingReports() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <AccountingReportsContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      isDemo
    />
  );
}

function LiveAccountingReports() {
  const { actor, status } = useAuth();

  return (
    <AccountingReportsContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      isDemo={false}
    />
  );
}

function AccountingReportsContent({
  clinicId,
  status,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceAccounting');
  const locale = useLocale();
  const [range, setRange] = useState<DateRange>(currentYearRange);
  const validRange = isValidRange(range);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  const reportParams = useMemo(
    () => ({ clinicId: clinicId ?? '', ...range }),
    [clinicId, range]
  );
  const trialBalance = useQuery({
    queryKey: ['finance', 'accounting', 'trial-balance', isDemo, reportParams],
    queryFn: () =>
      isDemo
        ? getDemoTrialBalance(reportParams)
        : accountingReportsTrialBalance(reportParams),
    enabled: hasScope && validRange,
  });
  const journalParams = { ...reportParams, limit: 10, page: 1 };
  const journal = useQuery({
    queryKey: ['finance', 'accounting', 'journal', isDemo, journalParams],
    queryFn: () =>
      isDemo
        ? getDemoJournal(journalParams)
        : accountingReportsJournal(journalParams),
    enabled: hasScope && validRange,
  });

  const setDate = (key: keyof DateRange, value: string) => {
    setRange((current) => ({ ...current, [key]: value }));
  };
  const isLoading =
    status === 'loading' ||
    (hasScope && (trialBalance.isPending || journal.isPending));

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpenCheck className="size-4" aria-hidden="true" />
            <span>{t('legacyBook')}</span>
            {isDemo && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                {t('demoData')}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasScope
              ? t('scope', { clinicId: clinicId ?? '' })
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
              value={range.dateFrom}
              onChange={(event) => setDate('dateFrom', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t('to')}
            <input
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground"
              type="date"
              value={range.dateTo}
              onChange={(event) => setDate('dateTo', event.target.value)}
            />
          </label>
        </div>
      </header>

      {!validRange && <InlineNotice message={t('invalidRange')} />}

      {(trialBalance.isError || journal.isError) && (
        <InlineNotice
          message={
            errorMessage(trialBalance.error) ??
            errorMessage(journal.error) ??
            t('loadError')
          }
          isError
        />
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t('trialBalance')}</CardTitle>
            <CardDescription>{t('trialBalanceDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasScope ? (
              <EmptyState
                label={
                  status === 'unauthenticated' ? t('noSession') : t('noClinic')
                }
              />
            ) : isLoading ? (
              <LoadingState label={t('loading')} />
            ) : trialBalance.data?.data.lines.length ? (
              <>
                <div className="mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  {trialBalance.data.data.isBalanced ? (
                    <CircleCheck
                      className="size-4 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertCircle
                      className="size-4 text-amber-600"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {trialBalance.data.data.isBalanced
                      ? t('balanced')
                      : t('notBalanced')}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">
                          {t('account')}
                        </th>
                        <th className="pb-2 px-3 text-right font-medium">
                          {t('debit')}
                        </th>
                        <th className="pb-2 pl-3 text-right font-medium">
                          {t('credit')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.data.data.lines.map((line) => (
                        <tr
                          key={line.accountId}
                          className="border-b last:border-0"
                        >
                          <td className="py-2.5 pr-3">
                            <span className="mr-2 font-mono text-xs text-muted-foreground">
                              {line.code}
                            </span>
                            <span>{line.name}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {formatDecimal(line.debitBalance, locale)}
                          </td>
                          <td className="pl-3 py-2.5 text-right tabular-nums">
                            {formatDecimal(line.creditBalance, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t font-semibold">
                      <tr>
                        <td className="pt-3 pr-3">{t('total')}</td>
                        <td className="px-3 pt-3 text-right tabular-nums">
                          {formatDecimal(
                            trialBalance.data.data.totals.debitBalance,
                            locale
                          )}
                        </td>
                        <td className="pl-3 pt-3 text-right tabular-nums">
                          {formatDecimal(
                            trialBalance.data.data.totals.creditBalance,
                            locale
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState label={t('noTrialBalance')} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('journal')}</CardTitle>
            <CardDescription>{t('journalDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasScope ? (
              <EmptyState
                label={
                  status === 'unauthenticated' ? t('noSession') : t('noClinic')
                }
              />
            ) : isLoading ? (
              <LoadingState label={t('loading')} />
            ) : journal.data?.data.length ? (
              <div className="space-y-3">
                {journal.data.data.map((entry) => (
                  <article key={entry.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {entry.entryNo
                            ? `#${entry.entryNo}`
                            : t('unassignedEntry')}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: 'medium',
                            }).format(new Date(entry.entryDate))}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {entry.description || t('noDescription')}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {t(`status.${entry.status}`)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 border-t pt-3">
                      {entry.lines.map((line, index) => (
                        <div
                          key={`${line.accountId}-${index}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 text-xs"
                        >
                          <span className="truncate">
                            <span className="mr-1 font-mono text-muted-foreground">
                              {line.code}
                            </span>
                            {line.name}
                          </span>
                          <span className="text-right tabular-nums">
                            {formatDecimal(line.debit, locale)}
                          </span>
                          <span className="text-right tabular-nums">
                            {formatDecimal(line.credit, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState label={t('noJournal')} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

type DemoReportParams = {
  clinicId: string;
  dateFrom: string;
  dateTo: string;
  limit?: number;
  page?: number;
};

const demoTrialBalanceLines: AccountingReportsTrialBalance200['data']['lines'] =
  [
    {
      accountId: 'demo-account-100',
      code: '100',
      name: 'Kasa',
      totalDebit: '150000.00',
      totalCredit: '40000.00',
      debitBalance: '110000.00',
      creditBalance: '0.00',
    },
    {
      accountId: 'demo-account-102',
      code: '102',
      name: 'Bankalar',
      totalDebit: '500000.00',
      totalCredit: '150000.00',
      debitBalance: '350000.00',
      creditBalance: '0.00',
    },
    {
      accountId: 'demo-account-120',
      code: '120',
      name: 'Alıcılar',
      totalDebit: '250000.00',
      totalCredit: '175000.00',
      debitBalance: '75000.00',
      creditBalance: '0.00',
    },
    {
      accountId: 'demo-account-191',
      code: '191',
      name: 'İndirilecek KDV',
      totalDebit: '50000.00',
      totalCredit: '15000.00',
      debitBalance: '35000.00',
      creditBalance: '0.00',
    },
    {
      accountId: 'demo-account-320',
      code: '320',
      name: 'Satıcılar',
      totalDebit: '100000.00',
      totalCredit: '250000.00',
      debitBalance: '0.00',
      creditBalance: '150000.00',
    },
    {
      accountId: 'demo-account-391',
      code: '391',
      name: 'Hesaplanan KDV',
      totalDebit: '20000.00',
      totalCredit: '60000.00',
      debitBalance: '0.00',
      creditBalance: '40000.00',
    },
    {
      accountId: 'demo-account-590',
      code: '590',
      name: 'Dönem Net Kârı',
      totalDebit: '0.00',
      totalCredit: '195000.00',
      debitBalance: '0.00',
      creditBalance: '195000.00',
    },
    {
      accountId: 'demo-account-600',
      code: '600',
      name: 'Yurtiçi Satışlar',
      totalDebit: '0.00',
      totalCredit: '330000.00',
      debitBalance: '0.00',
      creditBalance: '330000.00',
    },
    {
      accountId: 'demo-account-770',
      code: '770',
      name: 'Genel Yönetim Giderleri',
      totalDebit: '145000.00',
      totalCredit: '0.00',
      debitBalance: '145000.00',
      creditBalance: '0.00',
    },
  ];

const demoJournalEntries: AccountingReportsJournal200['data'] = [
  {
    id: 'demo-journal-2026-001',
    entryNo: '2026-001',
    entryDate: '2026-10-02T09:30:00.000Z',
    description: 'Tedavi hizmeti satış faturası',
    status: 'POSTED',
    totalDebit: '11800.00',
    totalCredit: '11800.00',
    lines: [
      {
        accountId: 'demo-account-120',
        code: '120',
        name: 'Alıcılar',
        partyId: null,
        debit: '11800.00',
        credit: '0.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-600',
        code: '600',
        name: 'Yurtiçi Satışlar',
        partyId: null,
        debit: '0.00',
        credit: '10000.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-391',
        code: '391',
        name: 'Hesaplanan KDV',
        partyId: null,
        debit: '0.00',
        credit: '1800.00',
        lineDesc: null,
      },
    ],
  },
  {
    id: 'demo-journal-2026-002',
    entryNo: '2026-002',
    entryDate: '2026-10-05T11:15:00.000Z',
    description: 'Hasta tahsilatı · kasa',
    status: 'POSTED',
    totalDebit: '5900.00',
    totalCredit: '5900.00',
    lines: [
      {
        accountId: 'demo-account-100',
        code: '100',
        name: 'Kasa',
        partyId: null,
        debit: '5900.00',
        credit: '0.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-120',
        code: '120',
        name: 'Alıcılar',
        partyId: null,
        debit: '0.00',
        credit: '5900.00',
        lineDesc: null,
      },
    ],
  },
  {
    id: 'demo-journal-2026-003',
    entryNo: '2026-003',
    entryDate: '2026-10-08T13:40:00.000Z',
    description: 'Hasta tahsilatı · banka',
    status: 'POSTED',
    totalDebit: '5900.00',
    totalCredit: '5900.00',
    lines: [
      {
        accountId: 'demo-account-102',
        code: '102',
        name: 'Bankalar',
        partyId: null,
        debit: '5900.00',
        credit: '0.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-120',
        code: '120',
        name: 'Alıcılar',
        partyId: null,
        debit: '0.00',
        credit: '5900.00',
        lineDesc: null,
      },
    ],
  },
  {
    id: 'demo-journal-2026-004',
    entryNo: '2026-004',
    entryDate: '2026-10-12T08:20:00.000Z',
    description: 'Sarf malzeme alış faturası',
    status: 'POSTED',
    totalDebit: '29500.00',
    totalCredit: '29500.00',
    lines: [
      {
        accountId: 'demo-account-770',
        code: '770',
        name: 'Genel Yönetim Giderleri',
        partyId: null,
        debit: '25000.00',
        credit: '0.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-191',
        code: '191',
        name: 'İndirilecek KDV',
        partyId: null,
        debit: '4500.00',
        credit: '0.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-320',
        code: '320',
        name: 'Satıcılar',
        partyId: null,
        debit: '0.00',
        credit: '29500.00',
        lineDesc: null,
      },
    ],
  },
  {
    id: 'demo-journal-2026-005',
    entryNo: '2026-005',
    entryDate: '2026-10-16T15:05:00.000Z',
    description: 'Tedarikçi ödemesi · banka',
    status: 'POSTED',
    totalDebit: '29500.00',
    totalCredit: '29500.00',
    lines: [
      {
        accountId: 'demo-account-320',
        code: '320',
        name: 'Satıcılar',
        partyId: null,
        debit: '29500.00',
        credit: '0.00',
        lineDesc: null,
      },
      {
        accountId: 'demo-account-102',
        code: '102',
        name: 'Bankalar',
        partyId: null,
        debit: '0.00',
        credit: '29500.00',
        lineDesc: null,
      },
    ],
  },
];

function includesDemoPeriod(params: DemoReportParams): boolean {
  return params.dateFrom <= '2026-10-20' && params.dateTo >= '2026-10-01';
}

function getDemoTrialBalance(
  params: DemoReportParams
): Promise<AccountingReportsTrialBalance200> {
  const hasData = includesDemoPeriod(params);
  const lines = hasData ? demoTrialBalanceLines : [];

  return Promise.resolve({
    data: {
      clinicId: params.clinicId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      lines,
      totals: hasData
        ? {
            totalDebit: '1215000.00',
            totalCredit: '1215000.00',
            debitBalance: '715000.00',
            creditBalance: '715000.00',
          }
        : {
            totalDebit: '0.00',
            totalCredit: '0.00',
            debitBalance: '0.00',
            creditBalance: '0.00',
          },
      isBalanced: true,
    },
  });
}

function getDemoJournal(
  params: DemoReportParams
): Promise<AccountingReportsJournal200> {
  const entries = includesDemoPeriod(params)
    ? demoJournalEntries.filter((entry) => {
        const entryDate = entry.entryDate.slice(0, 10);
        return entryDate >= params.dateFrom && entryDate <= params.dateTo;
      })
    : [];

  return Promise.resolve({ data: entries.slice(0, params.limit ?? 10) });
}

function InlineNotice({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      {label}
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
