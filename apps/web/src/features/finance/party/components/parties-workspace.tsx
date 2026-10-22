'use client';

import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { DateTimeManager } from '@shared/common';
import { useLocale, useTranslations } from 'next-intl';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Landmark,
  Mail,
  MapPin,
  CreditCard,
  Phone,
  ReceiptText,
  Search,
  UsersRound,
  X,
} from 'lucide-react';

import {
  usePartyFindParties,
  usePartyGetParty,
} from '@/api/generated/party-query/party-query';
import type {
  PartyFindPartiesParams,
  PartyResponseDto,
  PartyResponseDtoRolesItem,
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
import { AuthProvider, useAuth, type AuthStatus } from '@/lib/auth';
import { PaymentCollectionSheet } from '@/features/finance/payment/components/payment-collection-sheet';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const pageSize = 20;
const emptyParties: PartyResponseDto[] = [];

type RoleFilter = PartyResponseDtoRolesItem | 'ALL';

export function PartiesWorkspace() {
  if (mockingEnabled) return <MockParties />;

  return (
    <AuthProvider>
      <LiveParties />
    </AuthProvider>
  );
}

function MockParties() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <PartiesContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      isDemo
    />
  );
}

function LiveParties() {
  const { actor, status } = useAuth();

  return (
    <PartiesContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      isDemo={false}
    />
  );
}

function PartiesContent({
  clinicId,
  status,
  isDemo,
}: {
  clinicId: string | null;
  status: AuthStatus;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceParty');
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [page, setPage] = useState(1);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [collectionParty, setCollectionParty] =
    useState<PartyResponseDto | null>(null);
  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setPage(1);
    setSelectedPartyId(null);
  }, [clinicId]);

  const runtimeParams = useMemo(
    () => ({
      clinicId: clinicId ?? '',
      page,
      limit: pageSize,
      orderBy: 'asc' as const,
      orderByColumn: 'name',
      ...(appliedSearch
        ? {
            search: appliedSearch,
            searchColumn: 'name',
            searchOperator: 'AND' as const,
          }
        : {}),
      ...(role === 'ALL' ? {} : { role }),
    }),
    [appliedSearch, clinicId, page, role]
  );

  // OpenAPI currently marks the optional role query as required. Keep it out
  // of the request for the "all roles" view until the schema is regenerated.
  const params = runtimeParams as PartyFindPartiesParams;
  const partiesQuery = usePartyFindParties(params, {
    query: {
      enabled: hasScope && !isDemo,
      placeholderData: keepPreviousData,
      retry: false,
    },
  });
  const detailQuery = usePartyGetParty(selectedPartyId ?? '', {
    query: {
      enabled: hasScope && !isDemo && Boolean(selectedPartyId),
      retry: false,
    },
  });

  const filteredDemo = useMemo(
    () =>
      demoParties.filter(
        (party) =>
          (role === 'ALL' || party.roles.includes(role)) &&
          (!appliedSearch ||
            party.name
              .toLocaleLowerCase(locale)
              .includes(appliedSearch.toLocaleLowerCase(locale)))
      ),
    [appliedSearch, locale, role]
  );
  const parties = isDemo
    ? filteredDemo.slice((page - 1) * pageSize, page * pageSize)
    : (partiesQuery.data?.data ?? emptyParties);
  const pagination = isDemo
    ? {
        total: filteredDemo.length,
        page,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(filteredDemo.length / pageSize)),
      }
    : partiesQuery.data?.meta?.pagination;
  const selectedListParty = parties.find(
    (party) => party.id === selectedPartyId
  );
  const selectedParty = isDemo
    ? selectedListParty
    : (detailQuery.data?.data ?? selectedListParty);
  const isLoading =
    status === 'loading' || (hasScope && !isDemo && partiesQuery.isPending);

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const changeRole = (nextRole: RoleFilter) => {
    setRole(nextRole);
    setPage(1);
  };

  return (
    <main className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Landmark className="size-4" aria-hidden="true" />
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
        {hasScope && pagination && (
          <div className="rounded-lg border bg-card px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t('totalLabel')}</span>{' '}
            <span className="font-semibold tabular-nums">
              {pagination.total}
            </span>
          </div>
        )}
      </header>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('listTitle')}</CardTitle>
            <CardDescription>{t('listDescription')}</CardDescription>
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
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={t('roleFilter')}
          >
            {(
              ['ALL', 'CUSTOMER', 'PATIENT', 'SUPPLIER', 'EMPLOYEE'] as const
            ).map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={role === item ? 'default' : 'outline'}
                aria-pressed={role === item}
                onClick={() => changeRole(item)}
                disabled={!hasScope}
              >
                {t(`role.${item}`)}
              </Button>
            ))}
          </div>

          {partiesQuery.isError && !isDemo && <Notice label={t('loadError')} />}

          {!hasScope ? (
            <EmptyState
              label={
                status === 'unauthenticated' ? t('noSession') : t('noClinic')
              }
            />
          ) : isLoading ? (
            <EmptyState label={t('loading')} />
          ) : parties.length === 0 ? (
            <EmptyState
              label={
                appliedSearch || role !== 'ALL' ? t('noResults') : t('empty')
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[940px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-3 font-medium">{t('party')}</th>
                    <th className="pb-3 font-medium">{t('roles')}</th>
                    <th className="pb-3 font-medium">{t('contact')}</th>
                    <th className="pb-3 font-medium">{t('taxIdentity')}</th>
                    <th className="pb-3 font-medium">{t('eInvoice')}</th>
                    <th className="pb-3 text-right font-medium">
                      {t('status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {parties.map((party) => (
                    <tr
                      key={party.id}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/50 last:border-0"
                      tabIndex={0}
                      onClick={() => setSelectedPartyId(party.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedPartyId(party.id);
                        }
                      }}
                    >
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            {party.type === 'COMPANY' ? (
                              <Building2
                                className="size-4"
                                aria-hidden="true"
                              />
                            ) : (
                              <CircleUserRound
                                className="size-4"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{party.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {t(`type.${party.type}`)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {party.roles.map((partyRole) => (
                            <Badge key={partyRole} variant="outline">
                              {t(`role.${partyRole}`)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        <div>{displayValue(party.phone)}</div>
                        {party.email && (
                          <div className="max-w-56 truncate text-xs">
                            {party.email}
                          </div>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {displayValue(party.taxNumber ?? party.nationalId)}
                      </td>
                      <td className="py-3 pr-4">
                        {party.isEInvoiceUser === undefined ? (
                          <span className="text-muted-foreground">—</span>
                        ) : party.isEInvoiceUser ? (
                          <Badge variant="secondary">{t('registered')}</Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {t('notRegistered')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Badge
                          variant={party.isActive ? 'secondary' : 'outline'}
                        >
                          {party.isActive ? t('active') : t('inactive')}
                        </Badge>
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
                  disabled={page <= 1 || partiesQuery.isFetching}
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
                    page >= pagination.totalPages || partiesQuery.isFetching
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

      <PartyDetailSheet
        party={selectedParty}
        open={Boolean(selectedPartyId)}
        loading={!isDemo && detailQuery.isPending}
        failed={!isDemo && detailQuery.isError}
        locale={locale}
        onCollect={(partyToCollect) => {
          setCollectionParty(partyToCollect);
          setSelectedPartyId(null);
        }}
        onOpenChange={(open) => {
          if (!open) setSelectedPartyId(null);
        }}
      />
      <PaymentCollectionSheet
        party={collectionParty}
        clinicId={clinicId ?? ''}
        open={Boolean(collectionParty)}
        isDemo={isDemo}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setCollectionParty(null);
        }}
      />
    </main>
  );
}

function PartyDetailSheet({
  party,
  open,
  loading,
  failed,
  locale,
  onCollect,
  onOpenChange,
}: {
  party?: PartyResponseDto;
  open: boolean;
  loading: boolean;
  failed: boolean;
  locale: string;
  onCollect: (party: PartyResponseDto) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('FinanceParty');

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
          <div className="flex items-start justify-between gap-3 pr-8">
            <div>
              <SheetTitle>{party?.name ?? t('detailTitle')}</SheetTitle>
              <SheetDescription>{t('detailDescription')}</SheetDescription>
            </div>
            {party?.roles.includes('PATIENT') && party.originId && (
              <Button type="button" size="sm" onClick={() => onCollect(party)}>
                <CreditCard className="size-4" aria-hidden="true" />
                {t('collectPayment')}
              </Button>
            )}
          </div>
        </SheetHeader>

        {loading ? (
          <EmptyState label={t('detailLoading')} />
        ) : failed ? (
          <div className="p-5">
            <Notice label={t('detailError')} />
          </div>
        ) : party ? (
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={party.isActive ? 'secondary' : 'outline'}>
                {party.isActive ? t('active') : t('inactive')}
              </Badge>
              <Badge variant="outline">{t(`type.${party.type}`)}</Badge>
              {party.roles.map((partyRole) => (
                <Badge key={partyRole} variant="outline">
                  {t(`role.${partyRole}`)}
                </Badge>
              ))}
            </div>

            <DetailSection title={t('contact')} icon={UsersRound}>
              <DetailRow icon={Phone} label={t('phone')} value={party.phone} />
              <DetailRow icon={Mail} label={t('email')} value={party.email} />
              <DetailRow
                icon={MapPin}
                label={t('address')}
                value={party.address}
              />
            </DetailSection>

            <DetailSection title={t('taxAndInvoice')} icon={ReceiptText}>
              <DetailValue label={t('taxNumber')} value={party.taxNumber} />
              <DetailValue label={t('nationalId')} value={party.nationalId} />
              <DetailValue label={t('taxOffice')} value={party.taxOffice} />
              <DetailValue
                label={t('eInvoice')}
                value={
                  party.isEInvoiceUser === undefined
                    ? null
                    : party.isEInvoiceUser
                      ? t('registered')
                      : t('notRegistered')
                }
              />
              <DetailValue
                label={t('eInvoiceMailbox')}
                value={party.eInvoiceMailbox}
              />
            </DetailSection>

            <DetailSection title={t('accountConnections')} icon={Landmark}>
              <DetailValue
                label={t('receivableAccount')}
                value={
                  party.receivableAccountId === undefined
                    ? null
                    : party.receivableAccountId === null
                      ? t('notConnected')
                      : t('connected')
                }
              />
              <DetailValue
                label={t('payableAccount')}
                value={
                  party.payableAccountId === undefined
                    ? null
                    : party.payableAccountId === null
                      ? t('notConnected')
                      : t('connected')
                }
              />
              <p className="col-span-full text-xs text-muted-foreground">
                {t('balanceUnavailable')}
              </p>
            </DetailSection>

            <DetailSection title={t('systemInfo')} icon={CircleUserRound}>
              <DetailValue
                label={t('originLabel')}
                value={
                  party.originType ? t(`origin.${party.originType}`) : null
                }
              />
              <DetailValue label={t('partyId')} value={party.id} mono />
              <DetailValue
                label={t('createdAt')}
                value={
                  party.createdAt
                    ? formatShortDate(party.createdAt, locale)
                    : null
                }
              />
              <DetailValue
                label={t('updatedAt')}
                value={
                  party.updatedAt
                    ? formatShortDate(party.updatedAt, locale)
                    : null
                }
              />
            </DetailSection>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Landmark;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex gap-2 sm:col-span-2">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <DetailValue label={label} value={value} />
    </div>
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
        {displayValue(value)}
      </div>
    </div>
  );
}

function Notice({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
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

function displayValue(value: string | null | undefined): string {
  return value?.trim() || '—';
}

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

const demoParties: PartyResponseDto[] = [
  {
    id: 'demo-party-1',
    clinicId: 'clinic_fethiye',
    organizationId: 'org_as_yazilim',
    name: 'Elif Yıldız',
    type: 'INDIVIDUAL',
    roles: ['CUSTOMER', 'PATIENT'],
    isActive: true,
    email: 'elif.yildiz@example.com',
    phone: '+90 532 481 22 18',
    address: 'Fethiye, Muğla',
    taxNumber: null,
    taxOffice: null,
    isEInvoiceUser: false,
    eInvoiceMailbox: null,
    receivableAccountId: 'demo-account-120',
    payableAccountId: null,
    nationalId: null,
    originType: 'PATIENT',
    originId: 'demo-patient-1',
    createdAt: demoDate(48),
    updatedAt: demoDate(3),
  },
  {
    id: 'demo-party-2',
    clinicId: 'clinic_fethiye',
    organizationId: 'org_as_yazilim',
    name: 'DentPro Medikal A.Ş.',
    type: 'COMPANY',
    roles: ['SUPPLIER'],
    isActive: true,
    email: 'finans@dentpro.example',
    phone: '+90 212 555 11 40',
    address: 'Şişli, İstanbul',
    taxNumber: '1234567890',
    taxOffice: 'Şişli',
    isEInvoiceUser: true,
    eInvoiceMailbox: 'urn:mail:defaultgb@dentpro.example',
    receivableAccountId: null,
    payableAccountId: 'demo-account-320',
    nationalId: null,
    originType: 'SUPPLIER',
    originId: 'demo-supplier-1',
    createdAt: demoDate(131),
    updatedAt: demoDate(2),
  },
  {
    id: 'demo-party-3',
    clinicId: 'clinic_fethiye',
    organizationId: 'org_as_yazilim',
    name: 'Mert Kaya',
    type: 'INDIVIDUAL',
    roles: ['EMPLOYEE'],
    isActive: false,
    email: 'mert.kaya@example.com',
    phone: '+90 555 209 45 61',
    address: null,
    taxNumber: null,
    taxOffice: null,
    isEInvoiceUser: false,
    eInvoiceMailbox: null,
    receivableAccountId: null,
    payableAccountId: 'demo-account-335',
    nationalId: null,
    originType: 'USER',
    originId: 'demo-user-1',
    createdAt: demoDate(262),
    updatedAt: demoDate(51),
  },
];

function demoDate(daysAgo: number): string {
  return DateTimeManager.toIsoString(
    DateTimeManager.subtractDays(DateTimeManager.create(), daysAgo)
  );
}
