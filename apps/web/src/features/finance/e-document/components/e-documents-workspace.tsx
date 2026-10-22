'use client';

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  FileClock,
  FileText,
  Search,
  ShieldQuestion,
} from 'lucide-react';

import {
  invoiceGetById,
  invoiceList,
} from '@/api/generated/invoice-query/invoice-query';
import type {
  InvoiceListItemResponseDto,
  InvoiceListParams,
  InvoiceViewResponseDto,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import { formatMoney } from '@/features/finance/shared/utils/money-formatter.util';
import { useAuth, AuthProvider, type AuthStatus } from '@/lib/auth';
import { formatShortDate } from '@/lib/date-time';
import { EDocumentIntegrationSettings } from './e-document-integration-settings';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const queryRoot = ['finance', 'e-documents'] as const;
const pageSize = 20;
const emptyInvoices: InvoiceListItemResponseDto[] = [];

type EDocumentStatus =
  | 'ACCEPTED'
  | 'FAILED'
  | 'INTERNAL'
  | 'QUEUED'
  | 'SENT'
  | 'UNAVAILABLE';

type EDocumentType = 'E_ARSIV' | 'E_FATURA' | 'INTERNAL' | 'UNAVAILABLE';

type EDocumentRow = InvoiceListItemResponseDto & {
  documentType: EDocumentType;
  eDocumentStatus: EDocumentStatus;
  eDocumentUuid: string | null;
  providerReference: string | null;
};

export function EDocumentsWorkspace() {
  if (mockingEnabled) return <MockEDocuments />;

  return (
    <AuthProvider>
      <LiveEDocuments />
    </AuthProvider>
  );
}

function MockEDocuments() {
  const { actor, selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <EDocumentsContent
      clinicId={selectedClinicId}
      organizationId={actor.organizationId ?? null}
      status={hasHydrated ? 'authenticated' : 'loading'}
      isDemo
    />
  );
}

function LiveEDocuments() {
  const { actor, status } = useAuth();

  return (
    <EDocumentsContent
      clinicId={actor?.clinicId ?? null}
      organizationId={actor?.organizationId ?? null}
      status={status}
      isDemo={false}
    />
  );
}

function EDocumentsContent({
  clinicId,
  organizationId,
  status,
  isDemo,
}: {
  clinicId: string | null;
  organizationId: string | null;
  status: AuthStatus;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceEDocument');
  const locale = useLocale();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const hasScope =
    status === 'authenticated' &&
    (isDemo
      ? Boolean(clinicId && organizationId)
      : isUuid(clinicId) && isUuid(organizationId));

  useEffect(() => {
    setPage(1);
    setSearch('');
    setAppliedSearch('');
    setSelectedInvoiceId(null);
  }, [clinicId, organizationId]);

  const runtimeParams = useMemo(
    () => ({
      organizationId: organizationId ?? '',
      clinicId: clinicId ?? '',
      page,
      limit: pageSize,
      orderBy: 'desc' as const,
      orderByColumn: 'createdAt',
      ...(appliedSearch
        ? {
            search: appliedSearch,
            searchColumn: 'invoiceNumber',
            searchOperator: 'AND' as const,
          }
        : {}),
    }),
    [appliedSearch, clinicId, organizationId, page]
  );
  const listParams = runtimeParams as InvoiceListParams;

  const listQuery = useQuery({
    queryKey: [...queryRoot, 'list', runtimeParams],
    queryFn: ({ signal }) => invoiceList(listParams, signal),
    enabled: hasScope && !isDemo,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: [...queryRoot, 'detail', selectedInvoiceId],
    queryFn: ({ signal }) => invoiceGetById(selectedInvoiceId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(selectedInvoiceId),
    retry: false,
  });

  const filteredDemo = useMemo(() => {
    const needle = appliedSearch.toLocaleLowerCase(locale);
    return demoRows.filter((row) =>
      needle
        ? (row.invoiceNumber ?? '').toLocaleLowerCase(locale).includes(needle)
        : true
    );
  }, [appliedSearch, locale]);
  const liveInvoices = listQuery.data?.data ?? emptyInvoices;
  const rows: EDocumentRow[] = isDemo
    ? filteredDemo.slice((page - 1) * pageSize, page * pageSize)
    : liveInvoices.map(toUnavailableEDocument);
  const pagination = isDemo
    ? {
        total: filteredDemo.length,
        page,
        totalPages: Math.max(1, Math.ceil(filteredDemo.length / pageSize)),
      }
    : listQuery.data?.meta?.pagination;
  const selectedRow = rows.find((row) => row.id === selectedInvoiceId) ?? null;
  const selectedInvoice: InvoiceViewResponseDto | null = isDemo
    ? selectedRow
      ? toDemoDetail(selectedRow)
      : null
    : (detailQuery.data?.data ?? null);
  const pageSummary = summarize(rows);
  const isLoading =
    status === 'loading' || (hasScope && !isDemo && listQuery.isPending);

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="size-4" aria-hidden="true" />
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
                : t('noScope')}
          </p>
        </div>
        {hasScope && pagination && (
          <div className="rounded-lg border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t('totalLabel')}</span>{' '}
            <span className="font-semibold tabular-nums">
              {pagination.total}
            </span>
          </div>
        )}
      </header>

      <EDocumentIntegrationSettings
        clinicId={clinicId}
        organizationId={organizationId}
        hasScope={hasScope}
        isDemo={isDemo}
      />

      {!isDemo && hasScope && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-600/30 bg-amber-500/5 p-4">
          <ShieldQuestion
            className="mt-0.5 size-5 shrink-0 text-amber-600"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium">{t('integrationUnavailableTitle')}</p>
            <p className="text-sm text-muted-foreground">
              {t('integrationUnavailableDescription')}
            </p>
          </div>
        </div>
      )}

      {listQuery.error && (
        <Notice message={errorMessage(listQuery.error) ?? t('loadError')} />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={FileText}
          label={t('summary.total')}
          value={pagination?.total ?? 0}
        />
        <SummaryCard
          icon={FileClock}
          label={t('summary.inProgress')}
          value={isDemo ? pageSummary.inProgress : t('unknown')}
        />
        <SummaryCard
          icon={CircleCheckBig}
          label={t('summary.delivered')}
          value={isDemo ? pageSummary.delivered : t('unknown')}
        />
        <SummaryCard
          icon={AlertTriangle}
          label={t('summary.failed')}
          value={isDemo ? pageSummary.failed : t('unknown')}
        />
      </section>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>{t('listDescription')}</CardDescription>
          </div>
          <form className="flex w-full gap-2 lg:w-auto" onSubmit={applySearch}>
            <Input
              className="min-h-11 min-w-0 sm:w-72"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              disabled={!hasScope}
            />
            <Button
              className="min-h-11"
              type="submit"
              variant="outline"
              disabled={!hasScope}
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t('search')}</span>
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {!hasScope ? (
            <EmptyState
              label={
                status === 'unauthenticated' ? t('noSession') : t('noScope')
              }
            />
          ) : isLoading ? (
            <EmptyState label={t('loading')} />
          ) : rows.length === 0 ? (
            <EmptyState label={appliedSearch ? t('noResults') : t('empty')} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('invoiceNumber')}
                    </th>
                    <th className="px-3 py-2 font-medium">{t('issuedAt')}</th>
                    <th className="px-3 py-2 font-medium">
                      {t('documentType')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('invoiceStatus')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('eDocumentStatus')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t('amount')}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t('actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-3 font-medium">
                        {row.invoiceNumber ?? t('unassigned')}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {row.issuedAt
                          ? formatShortDate(row.issuedAt, locale)
                          : t('notIssued')}
                      </td>
                      <td className="px-3 py-3">
                        {t(`documentTypes.${row.documentType}`)}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.status}
                          label={t(`invoiceStatuses.${row.status}`)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={row.eDocumentStatus}
                          label={t(`eDocumentStatuses.${row.eDocumentStatus}`)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {formatMoney(row.grandTotal, row.currency) ??
                          t('masked')}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          className="min-h-11"
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoiceId(row.id)}
                        >
                          {t('view')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                    className="min-h-11"
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    {t('previous')}
                  </Button>
                  <Button
                    className="min-h-11"
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

      <Sheet
        open={Boolean(selectedInvoiceId)}
        onOpenChange={(open) => !open && setSelectedInvoiceId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {selectedRow?.invoiceNumber ?? t('detailTitle')}
            </SheetTitle>
            <SheetDescription>{t('detailDescription')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {!isDemo && detailQuery.isPending ? (
              <EmptyState label={t('detailLoading')} />
            ) : detailQuery.error ? (
              <Notice
                message={errorMessage(detailQuery.error) ?? t('detailError')}
              />
            ) : selectedInvoice && selectedRow ? (
              <>
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
                  <Detail
                    label={t('invoiceNumber')}
                    value={selectedRow.invoiceNumber ?? t('unassigned')}
                  />
                  <Detail
                    label={t('issuedAt')}
                    value={
                      selectedInvoice.issuedAt
                        ? formatShortDate(selectedInvoice.issuedAt, locale)
                        : t('notIssued')
                    }
                  />
                  <Detail
                    label={t('invoiceStatus')}
                    value={t(`invoiceStatuses.${selectedInvoice.status}`)}
                  />
                  <Detail
                    label={t('eDocumentStatus')}
                    value={t(
                      `eDocumentStatuses.${selectedRow.eDocumentStatus}`
                    )}
                  />
                  <Detail
                    label={t('documentType')}
                    value={t(`documentTypes.${selectedRow.documentType}`)}
                  />
                  <Detail
                    label={t('grandTotal')}
                    value={
                      formatMoney(
                        selectedInvoice.grandTotal,
                        selectedInvoice.currency
                      ) ?? t('masked')
                    }
                  />
                </div>

                <div className="rounded-lg border p-4">
                  <p className="font-medium">{t('externalTraceTitle')}</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Detail
                      label={t('uuid')}
                      value={selectedRow.eDocumentUuid ?? t('notAvailable')}
                    />
                    <Detail
                      label={t('providerReference')}
                      value={selectedRow.providerReference ?? t('notAvailable')}
                    />
                  </div>
                </div>

                {selectedRow.eDocumentStatus === 'UNAVAILABLE' && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-600/30 bg-amber-500/5 p-4">
                    <AlertTriangle
                      className="mt-0.5 size-5 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-muted-foreground">
                      {t('detailUnavailable')}
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-muted p-2">
          <Icon className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variant =
    status === 'ACCEPTED' || status === 'ISSUED'
      ? 'default'
      : status === 'FAILED' || status === 'CANCELLED'
        ? 'destructive'
        : 'secondary';
  return <Badge variant={variant}>{label}</Badge>;
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm font-medium">{value}</div>
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

function Notice({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function toUnavailableEDocument(
  invoice: InvoiceListItemResponseDto
): EDocumentRow {
  return {
    ...invoice,
    documentType: 'UNAVAILABLE',
    eDocumentStatus: 'UNAVAILABLE',
    eDocumentUuid: null,
    providerReference: null,
  };
}

function summarize(rows: EDocumentRow[]) {
  return rows.reduce(
    (summary, row) => {
      if (row.eDocumentStatus === 'ACCEPTED') summary.delivered += 1;
      if (row.eDocumentStatus === 'FAILED') summary.failed += 1;
      if (['QUEUED', 'SENT'].includes(row.eDocumentStatus)) {
        summary.inProgress += 1;
      }
      return summary;
    },
    { delivered: 0, failed: 0, inProgress: 0 }
  );
}

function toDemoDetail(row: EDocumentRow): InvoiceViewResponseDto {
  return {
    id: row.id,
    clinicId: row.clinicId,
    patientId: row.patientId,
    organizationId: row.organizationId,
    status: row.status,
    issuedAt: row.issuedAt,
    cancelledAt: null,
    cancelReason: null,
    netTotal: row.grandTotal,
    vatTotal: '0',
    grandTotal: row.grandTotal,
    vatRate: '0',
    currency: row.currency,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : null;
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

const demoRows: EDocumentRow[] = [
  {
    id: '0bced3d2-8842-4df0-958f-54fb98dce8a1',
    clinicId: 'demo-clinic',
    patientId: 'demo-patient-1',
    organizationId: 'demo-organization',
    invoiceNumber: 'INV-2026-0108',
    status: 'ISSUED',
    issuedAt: '2026-10-21T08:30:00.000Z',
    createdAt: '2026-10-21T08:30:00.000Z',
    grandTotal: '12500.00',
    currency: 'TRY',
    documentType: 'E_FATURA',
    eDocumentStatus: 'ACCEPTED',
    eDocumentUuid: 'b4eb826b-9c3c-4ca7-b58e-a6947fde7cb1',
    providerReference: 'PRV-784032',
  },
  {
    id: '5b2e115d-957c-4e68-8799-1a150b4a59cc',
    clinicId: 'demo-clinic',
    patientId: 'demo-patient-2',
    organizationId: 'demo-organization',
    invoiceNumber: 'INV-2026-0107',
    status: 'ISSUED',
    issuedAt: '2026-10-20T11:00:00.000Z',
    createdAt: '2026-10-20T11:00:00.000Z',
    grandTotal: '4800.00',
    currency: 'TRY',
    documentType: 'E_ARSIV',
    eDocumentStatus: 'QUEUED',
    eDocumentUuid: null,
    providerReference: null,
  },
  {
    id: '31c7dc0e-f2d1-46b2-8916-b3ff8e2301f8',
    clinicId: 'demo-clinic',
    patientId: 'demo-patient-3',
    organizationId: 'demo-organization',
    invoiceNumber: 'INV-2026-0106',
    status: 'FAILED',
    issuedAt: '2026-10-19T14:15:00.000Z',
    createdAt: '2026-10-19T14:15:00.000Z',
    grandTotal: '9250.00',
    currency: 'TRY',
    documentType: 'E_FATURA',
    eDocumentStatus: 'FAILED',
    eDocumentUuid: null,
    providerReference: 'PRV-783991',
  },
  {
    id: '10fa7743-fd2f-45fb-acdd-b1c71824cb9f',
    clinicId: 'demo-clinic',
    patientId: 'demo-patient-4',
    organizationId: 'demo-organization',
    invoiceNumber: 'INV-2026-0105',
    status: 'ISSUED',
    issuedAt: '2026-10-18T09:45:00.000Z',
    createdAt: '2026-10-18T09:45:00.000Z',
    grandTotal: '3100.00',
    currency: 'TRY',
    documentType: 'INTERNAL',
    eDocumentStatus: 'INTERNAL',
    eDocumentUuid: null,
    providerReference: null,
  },
];
