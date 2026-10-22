'use client';

import { SelectInput } from '@/components/ui/select-input';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Archive,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  Wallet,
} from 'lucide-react';

import {
  cashRegisterArchive,
  cashRegisterCreate,
} from '@/api/generated/cash-register-command/cash-register-command';
import {
  cashRegisterGetOpenSession,
  cashRegisterList,
} from '@/api/generated/cash-register-query/cash-register-query';
import {
  cashSessionClose,
  cashSessionOpen,
  cashSessionRecordMovement,
} from '@/api/generated/cash-session-command/cash-session-command';
import {
  cashSessionGetById,
  cashSessionList,
} from '@/api/generated/cash-session-query/cash-session-query';
import type {
  CashMovementResponseDto,
  CashRegisterResponseDto,
  CashSessionResponseDto,
  CreateCashRegisterDtoCurrency,
  RecordCashMovementDtoType,
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
import { formatAmount } from '@/features/finance/shared/utils/money-formatter.util';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const cashRegisterQueryRoot = ['finance', 'cash-register'] as const;
const currencies = ['TRY', 'USD', 'EUR', 'GBP'] as const;
const movementTypes: RecordCashMovementDtoType[] = [
  'CASH_IN',
  'CASH_OUT',
  'EXPENSE',
  'BANK_DEPOSIT',
  'SALE_COLLECTION',
  'REFUND_PAYOUT',
];
const historyPageSize = 5;

type CapabilityFlags = {
  canCreateRegister: boolean;
  canArchiveRegister: boolean;
  canOpenSession: boolean;
  canRecordMovement: boolean;
  canCloseSession: boolean;
};

export function CashRegisterWorkspace() {
  if (mockingEnabled) return <MockCashRegister />;

  return (
    <AuthProvider>
      <LiveCashRegister />
    </AuthProvider>
  );
}

function MockCashRegister() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <CashRegisterContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canCreateRegister
      canArchiveRegister
      canOpenSession
      canRecordMovement
      canCloseSession
      isDemo
    />
  );
}

function LiveCashRegister() {
  const { actor, status } = useAuth();

  return (
    <CashRegisterContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canCreateRegister={actorHasCapability(actor, 'cashregister:create')}
      canArchiveRegister={actorHasCapability(actor, 'cashregister:delete')}
      canOpenSession={actorHasCapability(actor, 'cashsession:create')}
      canRecordMovement={actorHasCapability(actor, 'cashmovement:create')}
      canCloseSession={actorHasCapability(actor, 'cashsession:update')}
      isDemo={false}
    />
  );
}

function CashRegisterContent({
  clinicId,
  status,
  canCreateRegister,
  canArchiveRegister,
  canOpenSession,
  canRecordMovement,
  canCloseSession,
  isDemo,
}: CapabilityFlags & {
  clinicId: string | null;
  status: AuthStatus;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceCashRegister');
  const locale = useLocale();
  const queryClient = useQueryClient();

  const [showArchived, setShowArchived] = useState(false);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string | null>(
    null
  );
  const [registerName, setRegisterName] = useState('');
  const [registerCurrency, setRegisterCurrency] =
    useState<CreateCashRegisterDtoCurrency>('TRY');
  const [openingFloat, setOpeningFloat] = useState('');
  const [openNote, setOpenNote] = useState('');
  const [movementType, setMovementType] =
    useState<RecordCashMovementDtoType>('CASH_IN');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementDescription, setMovementDescription] = useState('');
  const [movementReferenceType, setMovementReferenceType] = useState('');
  const [movementReferenceId, setMovementReferenceId] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  const [closeSummary, setCloseSummary] = useState<CloseSummary | null>(null);

  const [demoRegisters, setDemoRegisters] = useState(createDemoRegisters);
  const [demoOpenSessions, setDemoOpenSessions] = useState(
    createDemoOpenSessions
  );
  const [demoHistory, setDemoHistory] = useState(createDemoHistory);

  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setSelectedRegisterId(null);
    setHistoryPage(1);
    setCloseSummary(null);
    setNotice(null);
  }, [clinicId]);

  const registersQuery = useQuery({
    queryKey: [
      ...cashRegisterQueryRoot,
      'registers',
      isDemo,
      clinicId,
      showArchived,
    ],
    queryFn: ({ signal }) =>
      cashRegisterList(
        showArchived ? {} : { status: 'ACTIVE', limit: 100 },
        signal
      ),
    enabled: hasScope && !isDemo,
    retry: false,
  });
  const liveRegisters = registersQuery.data?.data ?? emptyRegisters;
  const registers = isDemo
    ? demoRegisters.filter(
        (register) => showArchived || register.status === 'ACTIVE'
      )
    : liveRegisters;

  useEffect(() => {
    if (!hasScope || registers.length === 0) return;
    if (registers.some((register) => register.id === selectedRegisterId))
      return;
    const firstActive = registers.find(
      (register) => register.status === 'ACTIVE'
    );
    setSelectedRegisterId(firstActive?.id ?? null);
  }, [hasScope, registers, selectedRegisterId]);

  const selectedRegister =
    registers.find((register) => register.id === selectedRegisterId) ?? null;

  const refreshAll = async () => {
    if (isDemo) return;
    await queryClient.invalidateQueries({ queryKey: cashRegisterQueryRoot });
  };

  const openSessionQuery = useQuery({
    queryKey: [
      ...cashRegisterQueryRoot,
      'open-session',
      isDemo,
      selectedRegisterId,
    ],
    queryFn: ({ signal }) =>
      cashRegisterGetOpenSession(selectedRegisterId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(selectedRegisterId),
    retry: false,
  });
  const openSessionId = isDemo
    ? (demoOpenSessions[selectedRegisterId ?? '']?.id ?? null)
    : (openSessionQuery.data?.data?.id ?? null);

  const sessionDetailQuery = useQuery({
    queryKey: [
      ...cashRegisterQueryRoot,
      'session-detail',
      isDemo,
      openSessionId,
    ],
    queryFn: ({ signal }) => cashSessionGetById(openSessionId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(openSessionId),
    retry: false,
  });
  const openSession = isDemo
    ? (demoOpenSessions[selectedRegisterId ?? ''] ?? null)
    : (sessionDetailQuery.data?.data ?? null);
  const movements = openSession?.movements ?? emptyMovements;

  const historyQuery = useQuery({
    queryKey: [
      ...cashRegisterQueryRoot,
      'history',
      isDemo,
      selectedRegisterId,
      historyPage,
    ],
    queryFn: ({ signal }) =>
      cashSessionList(
        {
          cashRegisterId: selectedRegisterId ?? '',
          status: 'CLOSED',
          page: historyPage,
          limit: historyPageSize,
          orderBy: 'desc',
          orderByColumn: 'openedAt',
        },
        signal
      ),
    enabled: hasScope && !isDemo && Boolean(selectedRegisterId),
    retry: false,
  });
  const history = isDemo
    ? (demoHistory[selectedRegisterId ?? ''] ?? emptySessions).slice(
        (historyPage - 1) * historyPageSize,
        historyPage * historyPageSize
      )
    : (historyQuery.data?.data ?? emptySessions);
  const historyTotal = isDemo
    ? (demoHistory[selectedRegisterId ?? ''] ?? emptySessions).length
    : (historyQuery.data?.meta?.pagination?.total ?? 0);
  const historyTotalPages = Math.max(
    1,
    Math.ceil(historyTotal / historyPageSize)
  );

  const createRegister = useMutation({
    mutationFn: async () => {
      if (!isValidName(registerName)) throw new Error(t('createError'));
      if (isDemo) return `demo-register-${Date.now()}`;
      return cashRegisterCreate({
        name: registerName.trim(),
        currency: registerCurrency,
        clinicId: clinicId ?? '',
      });
    },
    retry: false,
    onSuccess: async (id) => {
      if (isDemo) {
        const register = createDemoRegister(
          id,
          registerName.trim(),
          registerCurrency
        );
        setDemoRegisters((current) => [register, ...current]);
      } else {
        await refreshAll();
      }
      setRegisterName('');
      setNotice(t('created'));
    },
  });

  const archiveRegister = useMutation({
    mutationFn: async (registerId: string) => {
      if (isDemo) return;
      return cashRegisterArchive(registerId);
    },
    retry: false,
    onSuccess: async (_result, registerId) => {
      if (isDemo) {
        setDemoRegisters((current) =>
          current.map((register) =>
            register.id === registerId
              ? { ...register, status: 'ARCHIVED' }
              : register
          )
        );
      } else {
        await refreshAll();
      }
      setNotice(t('archived'));
    },
  });

  const openSessionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRegisterId) throw new Error(t('noRegisterSelected'));
      if (!isValidDecimal(openingFloat, { allowZero: true }))
        throw new Error(t('openError'));
      const parsedOpeningFloat = Number(openingFloat);
      if (isDemo) {
        if (demoOpenSessions[selectedRegisterId])
          throw new Error(t('openError'));
        return `demo-session-${Date.now()}`;
      }
      return cashSessionOpen({
        cashRegisterId: selectedRegisterId,
        openingFloat: parsedOpeningFloat,
        ...(openNote.trim() ? { note: openNote.trim() } : {}),
      });
    },
    retry: false,
    onSuccess: async (id) => {
      if (isDemo && selectedRegisterId) {
        const register = registers.find((r) => r.id === selectedRegisterId);
        setDemoOpenSessions((current) => ({
          ...current,
          [selectedRegisterId]: createDemoSession({
            id,
            cashRegisterId: selectedRegisterId,
            currency: register?.currency ?? 'TRY',
            clinicId: clinicId ?? 'demo-clinic',
            openingFloat: Number(openingFloat) || 0,
            note: openNote.trim() || null,
          }),
        }));
      } else {
        await refreshAll();
      }
      setOpeningFloat('');
      setOpenNote('');
      setCloseSummary(null);
      setNotice(t('opened'));
    },
  });

  const recordMovement = useMutation({
    mutationFn: async () => {
      if (!openSessionId) throw new Error(t('movementError'));
      if (!isValidDecimal(movementAmount, { allowZero: false }))
        throw new Error(t('movementError'));
      const parsedAmount = Number(movementAmount);
      if (isDemo) return;
      return cashSessionRecordMovement(openSessionId, {
        type: movementType,
        amount: parsedAmount,
        ...(movementDescription.trim()
          ? { description: movementDescription.trim() }
          : {}),
        ...(movementReferenceType.trim()
          ? { referenceType: movementReferenceType.trim() }
          : {}),
        ...(movementReferenceId.trim()
          ? { referenceId: movementReferenceId.trim() }
          : {}),
      });
    },
    retry: false,
    onSuccess: async () => {
      if (isDemo && selectedRegisterId && openSessionId) {
        setDemoOpenSessions((current) => {
          const session = current[selectedRegisterId];
          if (!session) return current;
          const movement = createDemoMovement({
            id: `demo-movement-${Date.now()}`,
            cashSessionId: openSessionId,
            clinicId: session.clinicId,
            currency: session.currency,
            type: movementType,
            amount: Number(movementAmount) || 0,
            description: movementDescription.trim() || null,
          });
          return {
            ...current,
            [selectedRegisterId]: {
              ...session,
              movements: [...(session.movements ?? []), movement],
            },
          };
        });
      } else {
        await refreshAll();
      }
      setMovementAmount('');
      setMovementDescription('');
      setMovementReferenceType('');
      setMovementReferenceId('');
      setNotice(t('recorded'));
    },
  });

  const closeSession = useMutation({
    mutationFn: async () => {
      if (!openSessionId) throw new Error(t('closeError'));
      if (!isValidDecimal(countedAmount, { allowZero: true }))
        throw new Error(t('closeError'));
      const parsedCounted = Number(countedAmount);
      if (isDemo) {
        const session = selectedRegisterId
          ? demoOpenSessions[selectedRegisterId]
          : null;
        if (!session) throw new Error(t('closeError'));
        const expected = demoExpectedAmount(session);
        return {
          sessionId: session.id,
          status: 'CLOSED',
          expectedAmount: expected.toFixed(2),
          countedAmount: parsedCounted.toFixed(2),
          difference: (parsedCounted - expected).toFixed(2),
        };
      }
      return cashSessionClose(openSessionId, { countedAmount: parsedCounted });
    },
    retry: false,
    onSuccess: async (result) => {
      const summary = readCloseSummary(result);
      if (isDemo && selectedRegisterId) {
        const session = demoOpenSessions[selectedRegisterId];
        if (session && summary) {
          const closedSession: CashSessionResponseDto = {
            ...session,
            status: 'CLOSED',
            closedAt: new Date().toISOString(),
            closedById: 'demo-user',
            expectedAmount: summary.expectedAmount,
            countedAmount: summary.countedAmount,
            difference: summary.difference,
          };
          setDemoHistory((current) => ({
            ...current,
            [selectedRegisterId]: [
              closedSession,
              ...(current[selectedRegisterId] ?? []),
            ],
          }));
        }
        setDemoOpenSessions((current) => ({
          ...current,
          [selectedRegisterId]: null,
        }));
      } else {
        await refreshAll();
      }
      setCountedAmount('');
      setCloseSummary(summary);
      setHistoryPage(1);
      setNotice(null);
    },
  });

  const mutationError =
    errorMessage(createRegister.error) ??
    errorMessage(archiveRegister.error) ??
    errorMessage(openSessionMutation.error) ??
    errorMessage(recordMovement.error) ??
    errorMessage(closeSession.error);

  const sessionLoading =
    hasScope &&
    !isDemo &&
    Boolean(selectedRegisterId) &&
    (openSessionQuery.isPending ||
      (Boolean(openSessionId) && sessionDetailQuery.isPending));

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="size-4" aria-hidden="true" />
          <span>{t('eyebrow')}</span>
          {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {hasScope
            ? t('description')
            : status === 'unauthenticated'
              ? t('noSession')
              : t('noClinic')}
        </p>
      </header>

      {(mutationError || registersQuery.isError) && (
        <Notice
          message={
            mutationError ??
            errorMessage(registersQuery.error) ??
            t('loadError')
          }
          error
        />
      )}
      {notice && <Notice message={notice} />}
      {closeSummary && (
        <Notice
          message={t('closedNotice', {
            expected: `${formatAmount(closeSummary.expectedAmount, selectedRegister?.currency)}`,
            counted: `${formatAmount(closeSummary.countedAmount, selectedRegister?.currency)}`,
            difference: `${formatAmount(closeSummary.difference, selectedRegister?.currency)}`,
          })}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('registersTitle')}</CardTitle>
              <CardDescription>{t('registersDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={!showArchived ? 'default' : 'outline'}
                  onClick={() => setShowArchived(false)}
                >
                  {t('filterActive')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={showArchived ? 'default' : 'outline'}
                  onClick={() => setShowArchived(true)}
                >
                  {t('filterAll')}
                </Button>
              </div>

              {!hasScope ? (
                <EmptyState
                  label={
                    status === 'unauthenticated'
                      ? t('noSession')
                      : t('noClinic')
                  }
                />
              ) : registersQuery.isPending && !isDemo ? (
                <EmptyState label={t('loadingSession')} />
              ) : registers.length === 0 ? (
                <EmptyState label={t('emptyRegisters')} />
              ) : (
                <ul className="space-y-2">
                  {registers.map((register) => (
                    <li
                      key={register.id}
                      className={`rounded-lg border p-3 ${
                        register.id === selectedRegisterId
                          ? 'border-primary bg-primary/5'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{register.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {register.currency}
                          </p>
                        </div>
                        <Badge
                          variant={
                            register.status === 'ACTIVE'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {t(`status.${register.status}`)}
                        </Badge>
                      </div>
                      <div className="mt-2 flex gap-2">
                        {register.id === selectedRegisterId ? (
                          <Badge variant="default">{t('selected')}</Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRegisterId(register.id);
                              setCloseSummary(null);
                              setNotice(null);
                            }}
                          >
                            {t('selectRegister')}
                          </Button>
                        )}
                        {canArchiveRegister && register.status === 'ACTIVE' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => archiveRegister.mutate(register.id)}
                            disabled={archiveRegister.isPending}
                          >
                            <Archive className="size-4" aria-hidden="true" />
                            {t('archive')}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canCreateRegister && hasScope && (
            <Card>
              <CardHeader>
                <CardTitle>{t('createTitle')}</CardTitle>
                <CardDescription>{t('createDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setNotice(null);
                    createRegister.mutate();
                  }}
                >
                  <Field label={t('name')}>
                    <Input
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                      placeholder={t('namePlaceholder')}
                      disabled={createRegister.isPending}
                    />
                  </Field>
                  <Field label={t('currency')}>
                    <SelectInput
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={registerCurrency}
                      onChange={(event) =>
                        setRegisterCurrency(
                          event.target.value as CreateCashRegisterDtoCurrency
                        )
                      }
                      disabled={createRegister.isPending}
                    >
                      {currencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Button
                    type="submit"
                    disabled={createRegister.isPending || !registerName.trim()}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    {createRegister.isPending ? t('creating') : t('create')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('sessionTitle')}</CardTitle>
              <CardDescription>{t('sessionDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasScope ? (
                <EmptyState
                  label={
                    status === 'unauthenticated'
                      ? t('noSession')
                      : t('noClinic')
                  }
                />
              ) : !selectedRegisterId ? (
                <EmptyState label={t('noRegisterSelected')} />
              ) : sessionLoading ? (
                <EmptyState label={t('loadingSession')} />
              ) : !openSession ? (
                canOpenSession ? (
                  <form
                    className="max-w-md space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setNotice(null);
                      openSessionMutation.mutate();
                    }}
                  >
                    <p className="text-sm text-muted-foreground">
                      {t('openDescription')}
                    </p>
                    <Field label={t('openingFloat')}>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={openingFloat}
                        onChange={(event) =>
                          setOpeningFloat(event.target.value)
                        }
                        disabled={openSessionMutation.isPending}
                      />
                    </Field>
                    <Field label={t('note')}>
                      <Input
                        value={openNote}
                        onChange={(event) => setOpenNote(event.target.value)}
                        placeholder={t('notePlaceholder')}
                        disabled={openSessionMutation.isPending}
                      />
                    </Field>
                    <Button
                      type="submit"
                      disabled={
                        openSessionMutation.isPending || !openingFloat.trim()
                      }
                    >
                      <Lock className="size-4" aria-hidden="true" />
                      {openSessionMutation.isPending
                        ? t('opening')
                        : t('openSession')}
                    </Button>
                  </form>
                ) : (
                  <EmptyState label={t('openDescription')} />
                )
              ) : (
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-3 font-semibold">
                      {t('currentSessionTitle')}
                    </h3>
                    <dl className="grid gap-3 sm:grid-cols-2">
                      <Metric
                        label={t('openedAt')}
                        value={formatDateTime(openSession.openedAt, locale)}
                      />
                      <Metric
                        label={t('openingFloatLabel')}
                        value={`${formatAmount(openSession.openingFloat, openSession.currency)}`}
                      />
                      <Metric
                        label={t('sessionCurrency')}
                        value={openSession.currency}
                      />
                      <Metric
                        label={t('openedBy')}
                        value={truncateId(openSession.openedById)}
                      />
                    </dl>
                  </section>

                  {canRecordMovement && (
                    <section>
                      <h3 className="mb-3 font-semibold">
                        {t('movementTitle')}
                      </h3>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {t('movementDescription')}
                      </p>
                      <form
                        className="grid gap-3 sm:grid-cols-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          setNotice(null);
                          recordMovement.mutate();
                        }}
                      >
                        <Field label={t('movementType')}>
                          <SelectInput
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={movementType}
                            onChange={(event) =>
                              setMovementType(
                                event.target.value as RecordCashMovementDtoType
                              )
                            }
                            disabled={recordMovement.isPending}
                          >
                            {movementTypes.map((type) => (
                              <option key={type} value={type}>
                                {t(`movementTypes.${type}`)}
                              </option>
                            ))}
                          </SelectInput>
                        </Field>
                        <Field label={t('amount')}>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0.01"
                            step="0.01"
                            value={movementAmount}
                            onChange={(event) =>
                              setMovementAmount(event.target.value)
                            }
                            disabled={recordMovement.isPending}
                          />
                        </Field>
                        <Field
                          label={t('descriptionLabel')}
                          className="sm:col-span-2"
                        >
                          <Input
                            value={movementDescription}
                            onChange={(event) =>
                              setMovementDescription(event.target.value)
                            }
                            placeholder={t('descriptionPlaceholder')}
                            disabled={recordMovement.isPending}
                          />
                        </Field>
                        <Field label={t('referenceType')}>
                          <Input
                            value={movementReferenceType}
                            onChange={(event) =>
                              setMovementReferenceType(event.target.value)
                            }
                            disabled={recordMovement.isPending}
                          />
                        </Field>
                        <Field label={t('referenceId')}>
                          <Input
                            value={movementReferenceId}
                            onChange={(event) =>
                              setMovementReferenceId(event.target.value)
                            }
                            disabled={recordMovement.isPending}
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Button
                            type="submit"
                            disabled={
                              recordMovement.isPending || !movementAmount.trim()
                            }
                          >
                            <Banknote className="size-4" aria-hidden="true" />
                            {recordMovement.isPending
                              ? t('recording')
                              : t('recordMovement')}
                          </Button>
                        </div>
                      </form>
                    </section>
                  )}

                  <section>
                    <h3 className="mb-3 font-semibold">
                      {t('movementsTitle')}
                    </h3>
                    {movements.length === 0 ? (
                      <EmptyState label={t('noMovements')} />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead className="border-b text-xs text-muted-foreground">
                            <tr>
                              <th className="pb-2 pr-3 font-medium">
                                {t('columnOccurredAt')}
                              </th>
                              <th className="pb-2 pr-3 font-medium">
                                {t('columnMovementType')}
                              </th>
                              <th className="pb-2 pr-3 font-medium">
                                {t('columnDirection')}
                              </th>
                              <th className="pb-2 pr-3 text-right font-medium">
                                {t('columnMovementAmount')}
                              </th>
                              <th className="pb-2 font-medium">
                                {t('columnMovementDescription')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {movements.map((movement) => (
                              <tr
                                key={movement.id}
                                className="border-b last:border-0"
                              >
                                <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                                  {formatDateTime(movement.occurredAt, locale)}
                                </td>
                                <td className="py-2.5 pr-3">
                                  {t(`movementTypes.${movement.type}`)}
                                </td>
                                <td className="py-2.5 pr-3">
                                  <Badge
                                    variant={
                                      movement.direction === 'IN'
                                        ? 'secondary'
                                        : 'outline'
                                    }
                                  >
                                    {t(`direction.${movement.direction}`)}
                                  </Badge>
                                </td>
                                <td className="py-2.5 pr-3 text-right tabular-nums">
                                  {formatAmount(
                                    movement.amount,
                                    movement.currency
                                  )}
                                </td>
                                <td className="py-2.5 max-w-56 truncate">
                                  {movement.description || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {canCloseSession && (
                    <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                      <h3 className="mb-1 font-semibold">{t('closeTitle')}</h3>
                      <p className="mb-3 text-sm text-muted-foreground">
                        {t('closeDescription')}
                      </p>
                      <form
                        className="flex flex-wrap items-end gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          setNotice(null);
                          closeSession.mutate();
                        }}
                      >
                        <Field label={t('countedAmount')}>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="0.01"
                            value={countedAmount}
                            onChange={(event) =>
                              setCountedAmount(event.target.value)
                            }
                            disabled={closeSession.isPending}
                          />
                        </Field>
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={
                            closeSession.isPending || !countedAmount.trim()
                          }
                        >
                          {closeSession.isPending ? t('closing') : t('close')}
                        </Button>
                      </form>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t('closeWarning')}
                      </p>
                    </section>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('historyTitle')}</CardTitle>
              <CardDescription>{t('historyDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!hasScope || !selectedRegisterId ? (
                <EmptyState label={t('noRegisterSelected')} />
              ) : !isDemo && historyQuery.isPending ? (
                <EmptyState label={t('loadingSession')} />
              ) : history.length === 0 ? (
                <EmptyState label={t('noHistory')} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="pb-2 pr-3 font-medium">
                          {t('columnHistoryStatus')}
                        </th>
                        <th className="pb-2 pr-3 font-medium">
                          {t('columnOpenedAt')}
                        </th>
                        <th className="pb-2 pr-3 font-medium">
                          {t('columnClosedAt')}
                        </th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          {t('columnOpeningFloat')}
                        </th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          {t('columnExpected')}
                        </th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          {t('columnCounted')}
                        </th>
                        <th className="pb-2 pr-3 text-right font-medium">
                          {t('columnDifference')}
                        </th>
                        <th className="pb-2 font-medium">
                          {t('columnPosting')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((session) => (
                        <tr key={session.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-3">
                            <Badge variant="outline">
                              {t(`sessionStatus.${session.status}`)}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(session.openedAt, locale)}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-muted-foreground">
                            {session.closedAt
                              ? formatDateTime(session.closedAt, locale)
                              : '—'}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {formatAmount(
                              session.openingFloat,
                              session.currency
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {session.expectedAmount
                              ? formatAmount(
                                  session.expectedAmount,
                                  session.currency
                                )
                              : '—'}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {session.countedAmount
                              ? formatAmount(
                                  session.countedAmount,
                                  session.currency
                                )
                              : '—'}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">
                            {session.difference
                              ? formatAmount(
                                  session.difference,
                                  session.currency
                                )
                              : '—'}
                          </td>
                          <td className="py-2.5">
                            {session.accountingEventId ? (
                              <Badge variant="secondary">
                                {t('postedBadge')}
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                {t('pendingPostingBadge')}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {hasScope && selectedRegisterId && historyTotalPages > 1 && (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t('page', {
                      page: historyPage,
                      totalPages: historyTotalPages,
                    })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setHistoryPage((current) => Math.max(1, current - 1))
                      }
                      disabled={historyPage <= 1}
                    >
                      <ChevronLeft className="size-4" aria-hidden="true" />
                      {t('previous')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setHistoryPage((current) =>
                          Math.min(historyTotalPages, current + 1)
                        )
                      }
                      disabled={historyPage >= historyTotalPages}
                    >
                      {t('next')}
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

type CloseSummary = {
  expectedAmount: string;
  countedAmount: string;
  difference: string;
};

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
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
  error = false,
}: {
  message: string;
  error?: boolean;
}) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={
        error
          ? 'flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive'
          : 'flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'
      }
    >
      {error ? (
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

const emptyRegisters: CashRegisterResponseDto[] = [];
const emptyMovements: CashMovementResponseDto[] = [];
const emptySessions: CashSessionResponseDto[] = [];

function isUuid(value: string | null): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isValidName(value: string): boolean {
  return value.trim().length > 0;
}

function isValidDecimal(
  value: string,
  { allowZero }: { allowZero: boolean }
): boolean {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return false;
  const number = Number(value);
  return allowZero ? number >= 0 : number > 0;
}

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

function readCloseSummary(value: unknown): CloseSummary | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const expectedAmount = record.expectedAmount;
  const countedAmount = record.countedAmount;
  const difference = record.difference;
  if (
    typeof expectedAmount !== 'string' ||
    typeof countedAmount !== 'string' ||
    typeof difference !== 'string'
  )
    return null;
  return { expectedAmount, countedAmount, difference };
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function createDemoRegister(
  id: string,
  name: string,
  currency: CreateCashRegisterDtoCurrency
): CashRegisterResponseDto {
  const now = new Date().toISOString();
  return {
    id,
    clinicId: 'demo-clinic',
    organizationId: 'demo-organization',
    name,
    currency,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  };
}

function createDemoRegisters(): CashRegisterResponseDto[] {
  return [
    createDemoRegister('demo-register-1', 'Resepsiyon Kasası', 'TRY'),
    createDemoRegister('demo-register-2', 'Şube Kasası', 'TRY'),
    {
      ...createDemoRegister('demo-register-3', 'Eski Kasa', 'TRY'),
      status: 'ARCHIVED',
    },
  ];
}

function createDemoSession(params: {
  id: string;
  cashRegisterId: string;
  currency: CashRegisterResponseDto['currency'];
  clinicId: string;
  openingFloat: number;
  note: string | null;
}): CashSessionResponseDto {
  const now = new Date().toISOString();
  return {
    id: params.id,
    cashRegisterId: params.cashRegisterId,
    clinicId: params.clinicId,
    organizationId: 'demo-organization',
    status: 'OPEN',
    currency: params.currency,
    openingFloat: params.openingFloat.toFixed(2),
    openedById: 'demo-user',
    closedById: null,
    openedAt: now,
    closedAt: null,
    movements: [],
    expectedAmount: null,
    countedAmount: null,
    difference: null,
    note: params.note,
    accountingEventId: null,
    postedToAccountingAt: null,
    createdAt: now,
  };
}

function createDemoMovement(params: {
  id: string;
  cashSessionId: string;
  clinicId: string;
  currency: CashMovementResponseDto['currency'];
  type: RecordCashMovementDtoType;
  amount: number;
  description: string | null;
}): CashMovementResponseDto {
  return {
    id: params.id,
    cashSessionId: params.cashSessionId,
    clinicId: params.clinicId,
    organizationId: 'demo-organization',
    type: params.type,
    direction: demoDirectionFor(params.type),
    currency: params.currency,
    amount: params.amount.toFixed(2),
    description: params.description,
    performedById: 'demo-user',
    occurredAt: new Date().toISOString(),
    referenceType: null,
    referenceId: null,
    createdAt: new Date().toISOString(),
  };
}

function demoDirectionFor(
  type: RecordCashMovementDtoType
): CashMovementResponseDto['direction'] {
  return type === 'CASH_IN' || type === 'SALE_COLLECTION' ? 'IN' : 'OUT';
}

function demoExpectedAmount(session: CashSessionResponseDto): number {
  const openingFloat = Number(session.openingFloat) || 0;
  const movementsTotal = (session.movements ?? []).reduce((total, movement) => {
    const amount = Number(movement.amount) || 0;
    return total + (movement.direction === 'IN' ? amount : -amount);
  }, 0);
  return openingFloat + movementsTotal;
}

function createDemoOpenSessions(): Record<
  string,
  CashSessionResponseDto | null
> {
  const session = createDemoSession({
    id: 'demo-session-open-1',
    cashRegisterId: 'demo-register-1',
    currency: 'TRY',
    clinicId: 'demo-clinic',
    openingFloat: 1500,
    note: null,
  });
  return {
    'demo-register-1': {
      ...session,
      movements: [
        createDemoMovement({
          id: 'demo-movement-1',
          cashSessionId: session.id,
          clinicId: 'demo-clinic',
          currency: 'TRY',
          type: 'SALE_COLLECTION',
          amount: 2400,
          description: 'Tedavi tahsilatı',
        }),
        createDemoMovement({
          id: 'demo-movement-2',
          cashSessionId: session.id,
          clinicId: 'demo-clinic',
          currency: 'TRY',
          type: 'EXPENSE',
          amount: 350,
          description: 'Ofis malzemesi',
        }),
      ],
    },
  };
}

function createDemoHistory(): Record<string, CashSessionResponseDto[]> {
  const closedAt = new Date().toISOString();
  return {
    'demo-register-1': [
      {
        ...createDemoSession({
          id: 'demo-session-closed-1',
          cashRegisterId: 'demo-register-1',
          currency: 'TRY',
          clinicId: 'demo-clinic',
          openingFloat: 1200,
          note: null,
        }),
        status: 'CLOSED',
        closedAt,
        closedById: 'demo-user',
        expectedAmount: '2850.00',
        countedAmount: '2850.00',
        difference: '0.00',
        accountingEventId: 'demo-accounting-event-1',
        postedToAccountingAt: closedAt,
      },
      {
        ...createDemoSession({
          id: 'demo-session-closed-2',
          cashRegisterId: 'demo-register-1',
          currency: 'TRY',
          clinicId: 'demo-clinic',
          openingFloat: 1000,
          note: null,
        }),
        status: 'CLOSED',
        closedAt,
        closedById: 'demo-user',
        expectedAmount: '2100.00',
        countedAmount: '2080.00',
        difference: '-20.00',
        accountingEventId: null,
        postedToAccountingAt: null,
      },
    ],
  };
}
