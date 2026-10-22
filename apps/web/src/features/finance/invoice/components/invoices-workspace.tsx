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
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  ReceiptText,
  Search,
  ShieldAlert,
  Wrench,
} from 'lucide-react';

import {
  invoiceBackfill,
  invoiceCancel,
} from '@/api/generated/invoice-command/invoice-command';
import {
  invoiceGetById,
  invoiceList,
  invoiceUninvoicedPayments,
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
import { formatShortDate } from '@/lib/date-time';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';
import { formatMoney } from '@/features/finance/shared/utils/money-formatter.util';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const invoiceQueryRoot = ['finance', 'invoices'] as const;
const pageSize = 20;
const emptyInvoices: InvoiceListItemResponseDto[] = [];

type DateRange = { from: string; to: string };
type UninvoicedPayment = {
  paymentId: string;
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  totalAmount: string;
  currency: string;
  firstCollectedAt: string;
};
type BackfillResult = {
  attempted: number;
  issued: number;
  failed: Array<{ paymentId: string; reason: string }>;
};

export function InvoicesWorkspace() {
  if (mockingEnabled) return <MockInvoices />;

  return (
    <AuthProvider>
      <LiveInvoices />
    </AuthProvider>
  );
}

function MockInvoices() {
  const { actor, selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <InvoicesContent
      clinicId={selectedClinicId}
      organizationId={actor.organizationId ?? null}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canBackfill
      canCancel
      isDemo
    />
  );
}

function LiveInvoices() {
  const { actor, status } = useAuth();

  return (
    <InvoicesContent
      clinicId={actor?.clinicId ?? null}
      organizationId={actor?.organizationId ?? null}
      status={status}
      canBackfill={actorHasCapability(actor, 'invoice:create')}
      canCancel={actorHasCapability(actor, 'invoice:delete')}
      isDemo={false}
    />
  );
}

function InvoicesContent({
  clinicId,
  organizationId,
  status,
  canBackfill,
  canCancel,
  isDemo,
}: {
  clinicId: string | null;
  organizationId: string | null;
  status: AuthStatus;
  canBackfill: boolean;
  canCancel: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceInvoice');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null
  );
  const [cancelReason, setCancelReason] = useState('');
  const [cancelConfirmed, setCancelConfirmed] = useState(false);
  const [backfillConfirmed, setBackfillConfirmed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoInvoices, setDemoInvoices] = useState(createDemoInvoices);
  const [demoMissing, setDemoMissing] = useState(createDemoMissingPayments);
  const hasScope =
    status === 'authenticated' &&
    (isDemo
      ? Boolean(clinicId && organizationId)
      : isUuid(clinicId) && isUuid(organizationId));
  const validRange = Boolean(range.from && range.to && range.from <= range.to);

  useEffect(() => {
    setPage(1);
    setSelectedInvoiceId(null);
    setCancelReason('');
    setCancelConfirmed(false);
    setBackfillConfirmed(false);
    setNotice(null);
  }, [clinicId, organizationId]);

  const runtimeListParams = useMemo(
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
  const listParams = runtimeListParams as InvoiceListParams;
  const reconciliationParams = {
    clinicId: clinicId ?? '',
    from: toRangeBoundary(range.from, 'start'),
    to: toRangeBoundary(range.to, 'end'),
  };

  const invoicesQuery = useQuery({
    queryKey: [...invoiceQueryRoot, 'list', isDemo, runtimeListParams],
    queryFn: ({ signal }) => invoiceList(listParams, signal),
    enabled: hasScope && !isDemo,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const missingQuery = useQuery({
    queryKey: [...invoiceQueryRoot, 'uninvoiced', isDemo, reconciliationParams],
    queryFn: ({ signal }) =>
      invoiceUninvoicedPayments(reconciliationParams, signal),
    enabled: hasScope && validRange && !isDemo,
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: [...invoiceQueryRoot, 'detail', selectedInvoiceId],
    queryFn: ({ signal }) => invoiceGetById(selectedInvoiceId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(selectedInvoiceId),
    retry: false,
  });

  const filteredDemo = useMemo(
    () =>
      demoInvoices.filter((invoice) =>
        appliedSearch
          ? (invoice.invoiceNumber ?? '')
              .toLocaleLowerCase(locale)
              .includes(appliedSearch.toLocaleLowerCase(locale))
          : true
      ),
    [appliedSearch, demoInvoices, locale]
  );
  const invoices = isDemo
    ? filteredDemo.slice((page - 1) * pageSize, page * pageSize)
    : (invoicesQuery.data?.data ?? emptyInvoices);
  const pagination = isDemo
    ? {
        total: filteredDemo.length,
        page,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(filteredDemo.length / pageSize)),
      }
    : invoicesQuery.data?.meta?.pagination;
  const missingPayments = isDemo
    ? demoMissing.filter((payment) => {
        const date = payment.firstCollectedAt.slice(0, 10);
        return date >= range.from && date <= range.to;
      })
    : readUninvoicedPayments(missingQuery.data);
  const selectedListInvoice = invoices.find(
    (invoice) => invoice.id === selectedInvoiceId
  );
  const selectedInvoice = isDemo
    ? selectedListInvoice
      ? demoDetail(selectedListInvoice)
      : null
    : (detailQuery.data?.data ?? null);
  const isLoading =
    status === 'loading' || (hasScope && !isDemo && invoicesQuery.isPending);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoiceId) throw new Error(t('cancelMissingSelection'));
      if (isDemo) return;
      return invoiceCancel(selectedInvoiceId, { reason: cancelReason.trim() });
    },
    retry: false,
    onSuccess: async () => {
      if (isDemo && selectedInvoiceId) {
        setDemoInvoices((current) =>
          current.map((invoice) =>
            invoice.id === selectedInvoiceId
              ? { ...invoice, status: 'CANCELLED' as const }
              : invoice
          )
        );
        setSelectedInvoiceId(null);
      } else {
        await queryClient.invalidateQueries({ queryKey: invoiceQueryRoot });
        setSelectedInvoiceId(null);
      }
      setCancelReason('');
      setCancelConfirmed(false);
      setNotice(t('cancelSuccess'));
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async (): Promise<BackfillResult> => {
      if (isDemo) {
        return {
          attempted: missingPayments.length,
          issued: missingPayments.length,
          failed: [],
        };
      }
      const response = await invoiceBackfill(reconciliationParams);
      return readBackfillResult(response);
    },
    retry: false,
    onSuccess: async (result) => {
      if (isDemo) setDemoMissing([]);
      await queryClient.invalidateQueries({ queryKey: invoiceQueryRoot });
      setBackfillConfirmed(false);
      setNotice(
        t('backfillSuccess', {
          attempted: result.attempted,
          issued: result.issued,
          failed: result.failed.length,
        })
      );
    },
  });

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };
  const changeRange = (key: keyof DateRange, value: string) => {
    setRange((current) => ({ ...current, [key]: value }));
    setBackfillConfirmed(false);
    setNotice(null);
  };
  const openDetail = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setCancelReason('');
    setCancelConfirmed(false);
  };
  const loadError = invoicesQuery.error ?? missingQuery.error;

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <ReceiptText className="size-4" aria-hidden="true" />
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

      {loadError && (
        <Notice message={errorMessage(loadError) ?? t('loadError')} error />
      )}
      {cancelMutation.isError && (
        <Notice
          message={errorMessage(cancelMutation.error) ?? t('cancelError')}
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
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('reconciliationTitle')}</CardTitle>
            <CardDescription>{t('reconciliationDescription')}</CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <DateField
              label={t('from')}
              value={range.from}
              onChange={(value) => changeRange('from', value)}
              disabled={!hasScope}
            />
            <DateField
              label={t('to')}
              value={range.to}
              onChange={(value) => changeRange('to', value)}
              disabled={!hasScope}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!validRange ? (
            <Notice message={t('invalidRange')} error />
          ) : !hasScope ? (
            <EmptyState label={t('noScope')} />
          ) : !isDemo && missingQuery.isPending ? (
            <EmptyState label={t('reconciliationLoading')} />
          ) : missingPayments.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-600/30 bg-emerald-500/5 p-4">
              <FileCheck2
                className="mt-0.5 size-5 text-emerald-600"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{t('reconciliationClean')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('reconciliationCleanDescription')}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-lg border border-amber-600/30 bg-amber-500/5 p-4">
                <AlertTriangle
                  className="mt-0.5 size-5 text-amber-600"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">
                    {t('missingTitle', { count: missingPayments.length })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('missingDescription')}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">
                        {t('collectedAt')}
                      </th>
                      <th className="px-3 py-2 font-medium">{t('payment')}</th>
                      <th className="px-3 py-2 font-medium">{t('patient')}</th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t('amount')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingPayments.map((payment) => (
                      <tr key={payment.paymentId} className="border-t">
                        <td className="px-3 py-3">
                          {formatShortDate(payment.firstCollectedAt, locale)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {shortId(payment.paymentId)}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs">
                          {shortId(payment.patientId)}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          {formatMoney(payment.totalAmount, payment.currency) ??
                            t('masked')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canBackfill && (
                <div className="space-y-3 rounded-lg border p-4">
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
                        {t('backfillConfirm')}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t('backfillWarning')}
                      </span>
                    </span>
                  </label>
                  <div className="flex justify-end">
                    <Button
                      className="min-h-11"
                      type="button"
                      onClick={() => backfillMutation.mutate()}
                      disabled={
                        !backfillConfirmed || backfillMutation.isPending
                      }
                    >
                      <Wrench className="size-4" aria-hidden="true" />
                      {backfillMutation.isPending
                        ? t('backfilling')
                        : t('backfill')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
          ) : invoices.length === 0 ? (
            <EmptyState label={appliedSearch ? t('noResults') : t('empty')} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('invoiceNumber')}
                    </th>
                    <th className="px-3 py-2 font-medium">{t('issuedAt')}</th>
                    <th className="px-3 py-2 font-medium">{t('patient')}</th>
                    <th className="px-3 py-2 font-medium">
                      {t('statusLabel')}
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
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-t">
                      <td className="px-3 py-3 font-medium">
                        {invoice.invoiceNumber ?? t('unassigned')}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {invoice.issuedAt
                          ? formatShortDate(invoice.issuedAt, locale)
                          : t('notIssued')}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {invoice.patientId
                          ? shortId(invoice.patientId)
                          : t('masked')}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge
                          status={invoice.status}
                          label={t(`status.${invoice.status}`)}
                        />
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">
                        {formatMoney(invoice.grandTotal, invoice.currency) ??
                          t('masked')}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          className="min-h-11"
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openDetail(invoice.id)}
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
              {selectedListInvoice?.invoiceNumber ?? t('detailTitle')}
            </SheetTitle>
            <SheetDescription>{t('detailDescription')}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {!isDemo && detailQuery.isPending ? (
              <EmptyState label={t('detailLoading')} />
            ) : detailQuery.error ? (
              <Notice
                message={errorMessage(detailQuery.error) ?? t('detailError')}
                error
              />
            ) : selectedInvoice ? (
              <>
                <div className="grid grid-cols-2 gap-3 rounded-lg border p-4">
                  <Detail
                    label={t('statusLabel')}
                    value={
                      <StatusBadge
                        status={selectedInvoice.status}
                        label={t(`status.${selectedInvoice.status}`)}
                      />
                    }
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
                    label={t('netTotal')}
                    value={
                      formatMoney(
                        selectedInvoice.netTotal,
                        selectedInvoice.currency
                      ) ?? t('masked')
                    }
                  />
                  <Detail
                    label={t('vatTotal')}
                    value={
                      formatMoney(
                        selectedInvoice.vatTotal,
                        selectedInvoice.currency
                      ) ?? t('masked')
                    }
                  />
                  <Detail
                    label={t('vatRate')}
                    value={
                      selectedInvoice.vatRate
                        ? t('percent', { value: selectedInvoice.vatRate })
                        : t('masked')
                    }
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
                  <Detail
                    label={t('patient')}
                    value={
                      selectedInvoice.patientId
                        ? shortId(selectedInvoice.patientId)
                        : t('masked')
                    }
                  />
                  <Detail
                    label={t('clinic')}
                    value={
                      selectedInvoice.clinicId
                        ? shortId(selectedInvoice.clinicId)
                        : t('masked')
                    }
                  />
                </div>

                {selectedInvoice.status === 'CANCELLED' && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <p className="font-medium text-destructive">
                      {t('cancelledTitle')}
                    </p>
                    <p className="mt-1 text-sm">
                      {selectedInvoice.cancelReason ?? t('cancelReasonMissing')}
                    </p>
                    {selectedInvoice.cancelledAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatShortDate(selectedInvoice.cancelledAt, locale)}
                      </p>
                    )}
                  </div>
                )}

                {canCancel && selectedInvoice.status === 'ISSUED' && (
                  <div className="space-y-4 rounded-lg border border-destructive/30 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert
                        className="mt-0.5 size-5 shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="font-medium">{t('cancelTitle')}</p>
                        <p className="text-sm text-muted-foreground">
                          {t('cancelDescription')}
                        </p>
                      </div>
                    </div>
                    <label className="grid gap-1 text-sm font-medium">
                      {t('cancelReason')}
                      <textarea
                        className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cancelReason}
                        onChange={(event) =>
                          setCancelReason(event.target.value)
                        }
                        placeholder={t('cancelReasonPlaceholder')}
                        maxLength={1000}
                        disabled={cancelMutation.isPending}
                      />
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        className="mt-0.5 size-4"
                        type="checkbox"
                        checked={cancelConfirmed}
                        onChange={(event) =>
                          setCancelConfirmed(event.target.checked)
                        }
                        disabled={cancelMutation.isPending}
                      />
                      <span>
                        <span className="block font-medium">
                          {t('cancelConfirm')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('cancelWarning')}
                        </span>
                      </span>
                    </label>
                    <div className="flex justify-end">
                      <Button
                        className="min-h-11"
                        type="button"
                        variant="destructive"
                        onClick={() => cancelMutation.mutate()}
                        disabled={
                          cancelReason.trim().length < 5 ||
                          !cancelConfirmed ||
                          cancelMutation.isPending
                        }
                      >
                        {cancelMutation.isPending
                          ? t('cancelling')
                          : t('cancelInvoice')}
                      </Button>
                    </div>
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

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variant =
    status === 'CANCELLED' || status === 'FAILED'
      ? 'destructive'
      : status === 'ISSUED'
        ? 'secondary'
        : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function DateField({
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
      <Input
        className="min-h-11"
        type="date"
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
      className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-destructive/40 bg-destructive/5 text-destructive' : 'border-emerald-600/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200'}`}
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
  const day = DateTimeManager.fromLocalDateTime(value, '00:00');
  return DateTimeManager.toIsoString(
    boundary === 'start'
      ? DateTimeManager.startOfDay(day)
      : DateTimeManager.endOfDay(day)
  );
}

function readUninvoicedPayments(response: unknown): UninvoicedPayment[] {
  const value = unwrapData(response);
  if (!Array.isArray(value)) return [];
  return value
    .filter(isUninvoicedPayment)
    .map((item) => ({ ...item, totalAmount: String(item.totalAmount) }));
}

function isUninvoicedPayment(value: unknown): value is UninvoicedPayment {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.paymentId === 'string' &&
    typeof row.clinicId === 'string' &&
    typeof row.patientId === 'string' &&
    (typeof row.totalAmount === 'string' ||
      typeof row.totalAmount === 'number') &&
    typeof row.currency === 'string' &&
    typeof row.firstCollectedAt === 'string'
  );
}

function readBackfillResult(response: unknown): BackfillResult {
  const value = unwrapData(response);
  if (!value || typeof value !== 'object')
    return { attempted: 0, issued: 0, failed: [] };
  const result = value as Record<string, unknown>;
  return {
    attempted: typeof result.attempted === 'number' ? result.attempted : 0,
    issued: typeof result.issued === 'number' ? result.issued : 0,
    failed: Array.isArray(result.failed)
      ? result.failed.filter(
          (item): item is { paymentId: string; reason: string } =>
            Boolean(
              item &&
              typeof item === 'object' &&
              typeof (item as Record<string, unknown>).paymentId === 'string' &&
              typeof (item as Record<string, unknown>).reason === 'string'
            )
        )
      : [],
  };
}

function unwrapData(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('data' in value)) return value;
  return (value as { data: unknown }).data;
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
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

function createDemoInvoices(): InvoiceListItemResponseDto[] {
  const today = DateTimeManager.create();
  const year = DateTimeManager.currentYear();
  return [
    demoInvoice('demo-invoice-1', `${year}-000184`, 'ISSUED', today, '4250.00'),
    demoInvoice(
      'demo-invoice-2',
      `${year}-000183`,
      'ISSUED',
      DateTimeManager.subtractDays(today, 2),
      '12800.00'
    ),
    demoInvoice(
      'demo-invoice-3',
      `${year}-000182`,
      'CANCELLED',
      DateTimeManager.subtractDays(today, 5),
      '1750.00'
    ),
    demoInvoice(
      'demo-invoice-4',
      null,
      'PENDING',
      DateTimeManager.subtractDays(today, 1),
      '3600.00'
    ),
  ];
}

function demoInvoice(
  id: string,
  invoiceNumber: string | null,
  status: InvoiceListItemResponseDto['status'],
  date: Date,
  grandTotal: string
): InvoiceListItemResponseDto {
  return {
    id,
    clinicId: 'demo-clinic',
    patientId: `demo-patient-${id.slice(-1)}`,
    invoiceNumber,
    status,
    issuedAt: status === 'PENDING' ? null : DateTimeManager.toIsoString(date),
    grandTotal,
    currency: 'TRY',
    organizationId: 'demo-organization',
    createdAt: DateTimeManager.toIsoString(date),
  };
}

function demoDetail(
  invoice: InvoiceListItemResponseDto
): InvoiceViewResponseDto {
  const gross = Number(invoice.grandTotal);
  const net = gross / 1.2;
  return {
    id: invoice.id,
    clinicId: invoice.clinicId,
    patientId: invoice.patientId,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    cancelledAt:
      invoice.status === 'CANCELLED'
        ? DateTimeManager.toIsoString(
            DateTimeManager.create(invoice.issuedAt ?? undefined)
          )
        : null,
    cancelReason: null,
    netTotal: net.toFixed(2),
    vatTotal: (gross - net).toFixed(2),
    grandTotal: invoice.grandTotal,
    vatRate: '20',
    currency: invoice.currency,
    organizationId: invoice.organizationId,
  };
}

function createDemoMissingPayments(): UninvoicedPayment[] {
  const now = DateTimeManager.create();
  return [
    {
      paymentId: 'demo-payment-91',
      clinicId: 'demo-clinic',
      patientId: 'demo-patient-7',
      appointmentId: 'demo-appointment-7',
      totalAmount: '5400.00',
      currency: 'TRY',
      firstCollectedAt: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(now, 3)
      ),
    },
    {
      paymentId: 'demo-payment-92',
      clinicId: 'demo-clinic',
      patientId: 'demo-patient-8',
      appointmentId: null,
      totalAmount: '900.00',
      currency: 'EUR',
      firstCollectedAt: DateTimeManager.toIsoString(
        DateTimeManager.subtractDays(now, 1)
      ),
    },
  ];
}
