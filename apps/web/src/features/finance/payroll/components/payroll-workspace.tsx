'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { DateTimeManager } from '@shared/common';
import { useLocale, useTranslations } from 'next-intl';
import {
  BadgeCheck,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { z } from 'zod';

import {
  usePayrollGetAccrualById,
  usePayrollGetAccruals,
} from '@/api/generated/payroll-query/payroll-query';
import { usePayrollRecordAccrual } from '@/api/generated/payroll-command/payroll-command';
import { useEmployeeList } from '@/api/generated/employee-query/employee-query';
import type {
  EmployeeResponseDto,
  PayrollAccrualResponseDto,
  PayrollGetAccrualsParams,
} from '@/api/generated/model';
import { EmployeeListStatus } from '@/api/generated/model';
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
import { formatMoney } from '@/features/finance/shared/utils/money-formatter.util';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const pageSize = 20;
const emptyAccruals: PayrollAccrualResponseDto[] = [];
const emptyEmployees: EmployeeResponseDto[] = [];
const payrollQueryRoot = ['finance', 'payroll'] as const;

const accrualAmountSchema = z.coerce.number().nonnegative().multipleOf(0.01);
const newAccrualSchema = z.object({
  employeeUserId: z.string().min(1),
  accrualDate: z.coerce.date(),
  grossSalary: accrualAmountSchema,
  employerSgk: accrualAmountSchema,
  netPayable: accrualAmountSchema,
  taxWithholding: accrualAmountSchema,
  employeeSgk: accrualAmountSchema,
});

export function PayrollWorkspace() {
  if (mockingEnabled) return <MockPayroll />;

  return (
    <AuthProvider>
      <LivePayroll />
    </AuthProvider>
  );
}

function MockPayroll() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <PayrollContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canCreate
      isDemo
    />
  );
}

function LivePayroll() {
  const { actor, status } = useAuth();

  return (
    <PayrollContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canCreate={actorHasCapability(actor, 'financialevent:create')}
      isDemo={false}
    />
  );
}

function PayrollContent({
  clinicId,
  status,
  canCreate,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  canCreate: boolean;
  isDemo: boolean;
}) {
  const t = useTranslations('FinancePayroll');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [appliedFilter, setAppliedFilter] = useState<{
    employeeUserId: string;
    monthKey: string;
  } | null>(null);
  const [selectedAccrualId, setSelectedAccrualId] = useState<string | null>(
    null
  );
  const [createOpen, setCreateOpen] = useState(false);

  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setPage(1);
    setSelectedAccrualId(null);
    setAppliedFilter(null);
    setEmployeeFilter('');
    setMonthFilter('');
  }, [clinicId]);

  const employeesQuery = useEmployeeList(
    { clinicId: clinicId ?? '', status: EmployeeListStatus.ACTIVE, limit: 100 },
    { query: { enabled: hasScope && !isDemo, retry: false } }
  );
  const employees = (isDemo ? demoEmployees : employeesQuery.data?.data) ?? [];
  const payableEmployees = useMemo(
    () => employees.filter((employee) => Boolean(employee.userId)),
    [employees]
  );

  const runtimeParams = useMemo(
    () => ({
      clinicId: clinicId ?? '',
      page,
      limit: pageSize,
      orderBy: 'desc' as const,
      orderByColumn: 'createdAt',
      ...(appliedFilter ?? {}),
    }),
    [appliedFilter, clinicId, page]
  );
  const params = runtimeParams as PayrollGetAccrualsParams;

  const accrualsQuery = usePayrollGetAccruals(params, {
    query: {
      enabled: hasScope && !isDemo,
      placeholderData: keepPreviousData,
      retry: false,
    },
  });
  const detailQuery = usePayrollGetAccrualById(selectedAccrualId ?? '', {
    query: {
      enabled: hasScope && !isDemo && Boolean(selectedAccrualId),
      retry: false,
    },
  });

  const filteredDemo = useMemo(
    () =>
      appliedFilter
        ? demoAccruals.filter(
            (accrual) =>
              accrual.employeeUserId === appliedFilter.employeeUserId &&
              accrual.monthKey === appliedFilter.monthKey
          )
        : demoAccruals,
    [appliedFilter]
  );
  const accruals = isDemo
    ? filteredDemo.slice((page - 1) * pageSize, page * pageSize)
    : (accrualsQuery.data?.data ?? emptyAccruals);
  const pagination = isDemo
    ? {
        total: filteredDemo.length,
        page,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(filteredDemo.length / pageSize)),
      }
    : accrualsQuery.data?.meta?.pagination;
  const selectedListAccrual = accruals.find(
    (accrual) => accrual.financialEventId === selectedAccrualId
  );
  const selectedAccrual = isDemo
    ? selectedListAccrual
    : (detailQuery.data?.data ?? selectedListAccrual);
  const isLoading =
    status === 'loading' || (hasScope && !isDemo && accrualsQuery.isPending);

  const applyFilter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeFilter && !monthFilter) {
      setAppliedFilter(null);
      setPage(1);
      return;
    }
    if (!employeeFilter || !monthFilter) return;
    setAppliedFilter({ employeeUserId: employeeFilter, monthKey: monthFilter });
    setPage(1);
  };

  const clearFilter = () => {
    setEmployeeFilter('');
    setMonthFilter('');
    setAppliedFilter(null);
    setPage(1);
  };

  const invalidatePayroll = () => {
    void queryClient.invalidateQueries({ queryKey: payrollQueryRoot });
  };

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <BriefcaseBusiness className="size-4" aria-hidden="true" />
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
        <div className="flex items-center gap-3">
          {hasScope && pagination && (
            <div className="rounded-lg border bg-card px-4 py-3 text-sm">
              <span className="text-muted-foreground">{t('totalLabel')}</span>{' '}
              <span className="font-semibold tabular-nums">
                {pagination.total}
              </span>
            </div>
          )}
          {hasScope && canCreate && (
            <Button type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t('newAccrual')}
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>{t('listDescription')}</CardDescription>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={applyFilter}
          >
            <label className="text-xs text-muted-foreground">
              <span className="mb-1 block">{t('filterEmployee')}</span>
              <SelectInput
                className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
                value={employeeFilter}
                onChange={(event) => setEmployeeFilter(event.target.value)}
                disabled={!hasScope}
              >
                <option value="">{t('filterAllEmployees')}</option>
                {payableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.userId ?? ''}>
                    {employee.firstName} {employee.lastName}
                  </option>
                ))}
              </SelectInput>
            </label>
            <label className="text-xs text-muted-foreground">
              <span className="mb-1 block">{t('filterMonth')}</span>
              <input
                type="month"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                disabled={!hasScope}
              />
            </label>
            <Button type="submit" variant="outline" disabled={!hasScope}>
              <Search className="size-4" aria-hidden="true" />
              {t('applyFilter')}
            </Button>
            {appliedFilter && (
              <Button type="button" variant="ghost" onClick={clearFilter}>
                {t('clearFilter')}
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent className="space-y-4">
          {Boolean(employeeFilter) !== Boolean(monthFilter) && (
            <p className="text-xs text-muted-foreground">
              {t('filterPairHint')}
            </p>
          )}

          {accrualsQuery.isError && !isDemo && (
            <Notice label={t('loadError')} />
          )}

          {!hasScope ? (
            <EmptyState
              label={
                status === 'unauthenticated' ? t('noSession') : t('noClinic')
              }
            />
          ) : isLoading ? (
            <EmptyState label={t('loading')} />
          ) : accruals.length === 0 ? (
            <EmptyState label={appliedFilter ? t('noResults') : t('empty')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">{t('employee')}</th>
                    <th className="pb-3 font-medium">{t('month')}</th>
                    <th className="pb-3 text-right font-medium">
                      {t('grossSalary')}
                    </th>
                    <th className="pb-3 text-right font-medium">
                      {t('employerSgk')}
                    </th>
                    <th className="pb-3 text-right font-medium">
                      {t('netPayable')}
                    </th>
                    <th className="pb-3 text-right font-medium">
                      {t('createdAt')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accruals.map((accrual) => (
                    <tr
                      key={accrual.financialEventId}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/50 last:border-0"
                      tabIndex={0}
                      onClick={() =>
                        setSelectedAccrualId(accrual.financialEventId)
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedAccrualId(accrual.financialEventId);
                        }
                      }}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">
                          {accrual.employeeName ?? t('unknownEmployee')}
                        </div>
                        {!accrual.employeeName && (
                          <div className="text-xs text-muted-foreground">
                            {t('partyIdLabel')}: {accrual.partyId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {accrual.monthKey}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatMoney(accrual.grossSalary)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                        {formatMoney(accrual.employerSgk)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatMoney(accrual.netPayable)}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {formatShortDate(accrual.createdAt, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasScope && pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {t('pagination', {
                  page: pagination.page,
                  totalPages: pagination.totalPages,
                  total: pagination.total,
                })}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || accrualsQuery.isFetching}
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
                  disabled={
                    page >= pagination.totalPages || accrualsQuery.isFetching
                  }
                >
                  {t('next')}
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AccrualDetailSheet
        accrual={selectedAccrual}
        open={Boolean(selectedAccrualId)}
        loading={!isDemo && detailQuery.isPending}
        failed={!isDemo && detailQuery.isError}
        locale={locale}
        onOpenChange={(open) => {
          if (!open) setSelectedAccrualId(null);
        }}
      />

      <NewAccrualSheet
        open={createOpen}
        clinicId={clinicId ?? ''}
        employees={payableEmployees}
        employeesLoading={!isDemo && employeesQuery.isPending}
        isDemo={isDemo}
        onOpenChange={setCreateOpen}
        onRecorded={invalidatePayroll}
      />
    </main>
  );
}

function AccrualDetailSheet({
  accrual,
  open,
  loading,
  failed,
  locale,
  onOpenChange,
}: {
  accrual?: PayrollAccrualResponseDto;
  open: boolean;
  loading: boolean;
  failed: boolean;
  locale: string;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('FinancePayroll');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-lg"
        showCloseButton={false}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3"
          aria-label={t('close')}
          title={t('close')}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <SheetTitle>{accrual?.employeeName ?? t('detailTitle')}</SheetTitle>
          <SheetDescription>{t('detailDescription')}</SheetDescription>
        </SheetHeader>

        {loading ? (
          <EmptyState label={t('detailLoading')} />
        ) : failed ? (
          <div className="p-5">
            <Notice label={t('detailError')} />
          </div>
        ) : accrual ? (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{accrual.monthKey}</Badge>
              <Badge variant="outline">
                {formatShortDate(accrual.accrualDate, locale)}
              </Badge>
            </div>

            <section className="rounded-xl border p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <BadgeCheck
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                {t('breakdownTitle')}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailValue
                  label={t('grossSalary')}
                  value={formatMoney(accrual.grossSalary)}
                />
                <DetailValue
                  label={t('employerSgk')}
                  value={formatMoney(accrual.employerSgk)}
                />
                <DetailValue
                  label={t('netPayable')}
                  value={formatMoney(accrual.netPayable)}
                />
                <DetailValue
                  label={t('taxWithholding')}
                  value={formatMoney(accrual.taxWithholding)}
                />
                <DetailValue
                  label={t('employeeSgk')}
                  value={formatMoney(accrual.employeeSgk)}
                />
              </div>
            </section>

            <section className="rounded-xl border p-4">
              <h3 className="mb-3 text-sm font-semibold">{t('systemInfo')}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailValue
                  label={t('partyIdLabel')}
                  value={accrual.partyId}
                  mono
                />
                <DetailValue
                  label={t('createdAt')}
                  value={formatShortDate(accrual.createdAt, locale)}
                />
              </div>
            </section>

            <p className="text-xs text-muted-foreground">
              {t('accountingHint')}
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function NewAccrualSheet({
  open,
  clinicId,
  employees,
  employeesLoading,
  isDemo,
  onOpenChange,
  onRecorded,
}: {
  open: boolean;
  clinicId: string;
  employees: EmployeeResponseDto[];
  employeesLoading: boolean;
  isDemo: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded: () => void;
}) {
  const t = useTranslations('FinancePayroll');
  const [employeeUserId, setEmployeeUserId] = useState('');
  const [accrualDate, setAccrualDate] = useState(() => todayInputValue());
  const [grossSalary, setGrossSalary] = useState('');
  const [employerSgk, setEmployerSgk] = useState('');
  const [netPayable, setNetPayable] = useState('');
  const [taxWithholding, setTaxWithholding] = useState('');
  const [employeeSgk, setEmployeeSgk] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeUserId((current) =>
      employees.some((employee) => employee.userId === current)
        ? current
        : (employees[0]?.userId ?? '')
    );
  }, [open, employees]);

  useEffect(() => {
    if (open) return;
    setGrossSalary('');
    setEmployerSgk('');
    setNetPayable('');
    setTaxWithholding('');
    setEmployeeSgk('');
    setAccrualDate(todayInputValue());
    setNotice(null);
    setValidationError(null);
  }, [open]);

  const recordAccrual = usePayrollRecordAccrual({
    mutation: {
      retry: false,
      onSuccess: () => {
        onRecorded();
        setNotice(t('recorded'));
        setGrossSalary('');
        setEmployerSgk('');
        setNetPayable('');
        setTaxWithholding('');
        setEmployeeSgk('');
      },
    },
  });

  const decomposedTotal = useMemo(() => {
    const net = Number(netPayable) || 0;
    const tax = Number(taxWithholding) || 0;
    const employeeShare = Number(employeeSgk) || 0;
    return net + tax + employeeShare;
  }, [netPayable, taxWithholding, employeeSgk]);
  const grossValue = Number(grossSalary) || 0;
  const isBalanced = Math.abs(grossValue - decomposedTotal) < 0.01;
  const hasAmounts = Boolean(
    grossSalary || netPayable || taxWithholding || employeeSgk
  );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setValidationError(null);

    const parsed = newAccrualSchema.safeParse({
      employeeUserId,
      accrualDate,
      grossSalary,
      employerSgk,
      netPayable,
      taxWithholding,
      employeeSgk,
    });
    if (!parsed.success) {
      setValidationError(t('validationError'));
      return;
    }

    if (isDemo) {
      setNotice(t('demoRecorded'));
      return;
    }

    recordAccrual.mutate({
      data: {
        clinicId,
        employeeUserId: parsed.data.employeeUserId,
        accrualDate: parsed.data.accrualDate.toISOString(),
        grossSalary: parsed.data.grossSalary,
        employerSgk: parsed.data.employerSgk,
        netPayable: parsed.data.netPayable,
        taxWithholding: parsed.data.taxWithholding,
        employeeSgk: parsed.data.employeeSgk,
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full overflow-y-auto sm:max-w-xl"
        showCloseButton={false}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute right-3 top-3"
          aria-label={t('close')}
          title={t('close')}
          onClick={() => onOpenChange(false)}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
        <SheetHeader className="border-b px-5 py-5 pr-14">
          <SheetTitle>{t('newAccrualTitle')}</SheetTitle>
          <SheetDescription>{t('newAccrualDescription')}</SheetDescription>
        </SheetHeader>

        <form className="space-y-5 p-5" onSubmit={submit}>
          <Field label={t('employee')}>
            <SelectInput
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={employeeUserId}
              onChange={(event) => setEmployeeUserId(event.target.value)}
              disabled={recordAccrual.isPending || employeesLoading}
            >
              <option value="">{t('selectEmployee')}</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.userId ?? ''}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </SelectInput>
            {!employeesLoading && employees.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('noPayableEmployee')}
              </p>
            )}
          </Field>

          <Field label={t('accrualDate')} hint={t('accrualDateHint')}>
            <Input
              type="date"
              value={accrualDate}
              onChange={(event) => setAccrualDate(event.target.value)}
              disabled={recordAccrual.isPending}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('grossSalary')}>
              <MoneyInput
                value={grossSalary}
                onChange={setGrossSalary}
                disabled={recordAccrual.isPending}
              />
            </Field>
            <Field label={t('employerSgk')}>
              <MoneyInput
                value={employerSgk}
                onChange={setEmployerSgk}
                disabled={recordAccrual.isPending}
              />
            </Field>
            <Field label={t('netPayable')}>
              <MoneyInput
                value={netPayable}
                onChange={setNetPayable}
                disabled={recordAccrual.isPending}
              />
            </Field>
            <Field label={t('taxWithholding')}>
              <MoneyInput
                value={taxWithholding}
                onChange={setTaxWithholding}
                disabled={recordAccrual.isPending}
              />
            </Field>
            <Field label={t('employeeSgk')} className="sm:col-span-2">
              <MoneyInput
                value={employeeSgk}
                onChange={setEmployeeSgk}
                disabled={recordAccrual.isPending}
              />
            </Field>
          </div>

          {hasAmounts && (
            <div
              className={
                isBalanced
                  ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300'
                  : 'rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-700 dark:text-amber-300'
              }
            >
              {t('balanceCheck', {
                gross: formatMoney(grossValue.toFixed(2)) ?? '—',
                decomposed: formatMoney(decomposedTotal.toFixed(2)) ?? '—',
              })}
            </div>
          )}

          {validationError && <Notice error label={validationError} />}
          {Boolean(recordAccrual.error) && (
            <Notice
              error
              label={errorMessage(recordAccrual.error) ?? t('submitError')}
            />
          )}
          {notice && <Notice label={notice} />}

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            <Button
              type="submit"
              disabled={
                recordAccrual.isPending || !employeeUserId || !accrualDate
              }
            >
              {recordAccrual.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {recordAccrual.isPending ? t('recording') : t('record')}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function MoneyInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min="0"
      step="0.01"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="0.00"
      disabled={disabled}
    />
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

function DetailValue({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={mono ? 'break-all font-mono text-xs' : 'break-words text-sm'}
      >
        {value?.trim() || '—'}
      </div>
    </div>
  );
}

function Notice({ label, error = false }: { label: string; error?: boolean }) {
  return (
    <div
      className={
        error
          ? 'rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive'
          : 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300'
      }
    >
      {label}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
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

function todayInputValue(): string {
  return DateTimeManager.toIsoString(DateTimeManager.create()).slice(0, 10);
}

const demoEmployees: EmployeeResponseDto[] = [
  {
    id: 'demo-employee-1',
    organizationId: 'org_as_yazilim',
    clinicId: 'clinic_fethiye',
    firstName: 'Ayşe',
    lastName: 'Yılmaz',
    email: 'ayse.yilmaz@example.com',
    phone: '+90 532 111 22 33',
    title: 'Resepsiyon Sorumlusu',
    department: 'Resepsiyon',
    hireDate: demoDate(400),
    nationalId: null,
    userId: 'demo-user-ayse',
    annualLeaveEntitlement: 14,
    terminationDate: null,
    updatedAt: demoDate(10),
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
  },
  {
    id: 'demo-employee-2',
    organizationId: 'org_as_yazilim',
    clinicId: 'clinic_fethiye',
    firstName: 'Mert',
    lastName: 'Kaya',
    email: 'mert.kaya@example.com',
    phone: '+90 555 209 45 61',
    title: 'Klinik Asistanı',
    department: 'Klinik',
    hireDate: demoDate(260),
    nationalId: null,
    userId: 'demo-user-mert',
    annualLeaveEntitlement: 14,
    terminationDate: null,
    updatedAt: demoDate(51),
    employmentType: 'FULL_TIME',
    status: 'ACTIVE',
  },
];

const demoAccruals: PayrollAccrualResponseDto[] = [
  {
    financialEventId: 'demo-accrual-1',
    clinicId: 'clinic_fethiye',
    partyId: 'demo-party-ayse',
    employeeUserId: 'demo-user-ayse',
    employeeName: 'Ayşe Yılmaz',
    monthKey: currentMonthKey(),
    accrualDate: demoDate(5),
    grossSalary: '50000.00',
    employerSgk: '10750.00',
    netPayable: '38500.00',
    taxWithholding: '4500.00',
    employeeSgk: '7000.00',
    dedupeKey: null,
    createdAt: demoDate(5),
  },
  {
    financialEventId: 'demo-accrual-2',
    clinicId: 'clinic_fethiye',
    partyId: 'demo-party-mert',
    employeeUserId: 'demo-user-mert',
    employeeName: 'Mert Kaya',
    monthKey: currentMonthKey(),
    accrualDate: demoDate(5),
    grossSalary: '42000.00',
    employerSgk: '9030.00',
    netPayable: '32340.00',
    taxWithholding: '3780.00',
    employeeSgk: '5880.00',
    dedupeKey: null,
    createdAt: demoDate(5),
  },
  {
    financialEventId: 'demo-accrual-3',
    clinicId: 'clinic_fethiye',
    partyId: 'demo-party-ayse',
    employeeUserId: 'demo-user-ayse',
    employeeName: 'Ayşe Yılmaz',
    monthKey: previousMonthKey(),
    accrualDate: demoDate(35),
    grossSalary: '50000.00',
    employerSgk: '10750.00',
    netPayable: '38500.00',
    taxWithholding: '4500.00',
    employeeSgk: '7000.00',
    dedupeKey: null,
    createdAt: demoDate(35),
  },
];

function demoDate(daysAgo: number): string {
  return DateTimeManager.toIsoString(
    DateTimeManager.subtractDays(DateTimeManager.create(), daysAgo)
  );
}

function currentMonthKey(): string {
  return DateTimeManager.toMonthKey(DateTimeManager.create());
}

function previousMonthKey(): string {
  return DateTimeManager.toMonthKey(
    DateTimeManager.subtractDays(DateTimeManager.create(), 35)
  );
}
