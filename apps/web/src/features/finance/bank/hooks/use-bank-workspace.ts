import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { useTranslations } from 'next-intl';

import {
  bankAccountArchive,
  bankAccountCreate,
} from '@/api/generated/bank-account-command/bank-account-command';
import { bankAccountList } from '@/api/generated/bank-account-query/bank-account-query';
import {
  bankStatementAutoMatch,
  bankStatementImport,
  bankStatementReconcileLine,
} from '@/api/generated/bank-statement-command/bank-statement-command';
import {
  bankStatementGetById,
  bankStatementLineSuggestions,
  bankStatementList,
  bankStatementReconciliationSummary,
} from '@/api/generated/bank-statement-query/bank-statement-query';
import type {
  BankAccountResponseDto,
  BankStatementLineResponseDto,
  BankStatementResponseDto,
  CreateBankAccountDtoCurrency,
  LineMatchSuggestionResponseDto,
  ReconcileStatementLineDtoMatchStatus,
} from '@/api/generated/model';
import type { BankStatementImportPayload } from '@/features/finance/bank/components/bank-statement-import-wizard';
import {
  autoMatchDemoLines,
  computeDemoSummary,
  createDemoAccount,
  createDemoAccounts,
  createDemoStatement,
  createDemoStatements,
  createDemoSuggestions,
} from '@/features/finance/bank/data/mock-bank-data';
import {
  errorMessage,
  isUuid,
  isValidName,
  isValidSignedDecimal,
  parseStatementLines,
} from '@/features/finance/bank/utils/bank-workspace.utils';
import type { AuthStatus } from '@/lib/auth';

const bankQueryRoot = ['finance', 'bank'] as const;
const statementsPageSize = 5;

const emptyAccounts: BankAccountResponseDto[] = [];
const emptyStatements: BankStatementResponseDto[] = [];
const emptyLines: BankStatementLineResponseDto[] = [];
const emptySuggestions: LineMatchSuggestionResponseDto[] = [];

export type BankWorkspaceCapabilities = {
  canCreateAccount: boolean;
  canArchiveAccount: boolean;
  canImportStatement: boolean;
  canReconcileLine: boolean;
};

type UseBankWorkspaceParams = BankWorkspaceCapabilities & {
  clinicId: string | null;
  status: AuthStatus;
  isDemo: boolean;
  t: ReturnType<typeof useTranslations>;
};

export function useBankWorkspace({
  clinicId,
  status,
  isDemo,
  canCreateAccount,
  canArchiveAccount,
  canImportStatement,
  canReconcileLine,
  t,
}: UseBankWorkspaceParams) {
  const queryClient = useQueryClient();

  const [showArchived, setShowArchived] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null
  );
  const [accountName, setAccountName] = useState('');
  const [accountBankName, setAccountBankName] = useState('');
  const [accountCurrency, setAccountCurrency] =
    useState<CreateBankAccountDtoCurrency>('TRY');
  const [accountOpeningBalance, setAccountOpeningBalance] = useState('');
  const [accountIban, setAccountIban] = useState('');
  const [accountNo, setAccountNo] = useState('');

  const [statementsPage, setStatementsPage] = useState(1);
  const [selectedStatementId, setSelectedStatementId] = useState<
    string | null
  >(null);

  const [showAdvancedPaste, setShowAdvancedPaste] = useState(false);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [openingBalanceInput, setOpeningBalanceInput] = useState('');
  const [closingBalanceInput, setClosingBalanceInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [linesRaw, setLinesRaw] = useState('');

  const [dateToleranceDays, setDateToleranceDays] = useState('3');
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const [demoAccounts, setDemoAccounts] = useState(createDemoAccounts);
  const [demoStatements, setDemoStatements] = useState(createDemoStatements);

  const hasScope =
    status === 'authenticated' &&
    (isDemo ? Boolean(clinicId) : isUuid(clinicId));

  useEffect(() => {
    setSelectedAccountId(null);
    setSelectedStatementId(null);
    setSelectedLineId(null);
    setNotice(null);
  }, [clinicId]);

  useEffect(() => {
    setSelectedStatementId(null);
    setSelectedLineId(null);
    setStatementsPage(1);
  }, [selectedAccountId]);

  useEffect(() => {
    setSelectedLineId(null);
  }, [selectedStatementId]);

  const accountsQuery = useQuery({
    queryKey: [...bankQueryRoot, 'accounts', isDemo, clinicId, showArchived],
    queryFn: ({ signal }) =>
      bankAccountList(
        showArchived ? { limit: 100 } : { status: 'ACTIVE', limit: 100 },
        signal
      ),
    enabled: hasScope && !isDemo,
    retry: false,
  });
  const liveAccounts = accountsQuery.data?.data ?? emptyAccounts;
  const accounts = isDemo
    ? demoAccounts.filter(
        (account) => showArchived || account.status === 'ACTIVE'
      )
    : liveAccounts;

  useEffect(() => {
    if (!hasScope || accounts.length === 0) return;
    if (accounts.some((account) => account.id === selectedAccountId)) return;
    const firstActive = accounts.find(
      (account) => account.status === 'ACTIVE'
    );
    setSelectedAccountId(firstActive?.id ?? null);
  }, [hasScope, accounts, selectedAccountId]);

  const selectedAccount =
    accounts.find((account) => account.id === selectedAccountId) ?? null;

  const refreshAll = async () => {
    if (isDemo) return;
    await queryClient.invalidateQueries({ queryKey: bankQueryRoot });
  };

  const statementsQuery = useQuery({
    queryKey: [
      ...bankQueryRoot,
      'statements',
      isDemo,
      selectedAccountId,
      statementsPage,
    ],
    queryFn: ({ signal }) =>
      bankStatementList(
        {
          bankAccountId: selectedAccountId ?? '',
          page: statementsPage,
          limit: statementsPageSize,
          orderBy: 'desc',
          orderByColumn: 'periodEnd',
        },
        signal
      ),
    enabled: hasScope && !isDemo && Boolean(selectedAccountId),
    retry: false,
  });
  const demoAccountStatements = isDemo
    ? (demoStatements[selectedAccountId ?? ''] ?? emptyStatements)
    : emptyStatements;
  const statements = isDemo
    ? demoAccountStatements.slice(
        (statementsPage - 1) * statementsPageSize,
        statementsPage * statementsPageSize
      )
    : (statementsQuery.data?.data ?? emptyStatements);
  const statementsTotal = isDemo
    ? demoAccountStatements.length
    : (statementsQuery.data?.meta?.pagination?.total ?? 0);
  const statementsTotalPages = Math.max(
    1,
    Math.ceil(statementsTotal / statementsPageSize)
  );

  useEffect(() => {
    if (!hasScope || statements.length === 0) return;
    if (statements.some((statement) => statement.id === selectedStatementId))
      return;
    setSelectedStatementId(statements[0]?.id ?? null);
  }, [hasScope, statements, selectedStatementId]);

  const statementDetailQuery = useQuery({
    queryKey: [
      ...bankQueryRoot,
      'statement-detail',
      isDemo,
      selectedStatementId,
    ],
    queryFn: ({ signal }) =>
      bankStatementGetById(selectedStatementId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(selectedStatementId),
    retry: false,
  });
  const selectedStatement = isDemo
    ? (demoAccountStatements.find(
        (statement) => statement.id === selectedStatementId
      ) ?? null)
    : (statementDetailQuery.data?.data ?? null);
  const lines = selectedStatement?.lines ?? emptyLines;

  const summaryQuery = useQuery({
    queryKey: [
      ...bankQueryRoot,
      'reconciliation-summary',
      isDemo,
      selectedStatementId,
    ],
    queryFn: ({ signal }) =>
      bankStatementReconciliationSummary(selectedStatementId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(selectedStatementId),
    retry: false,
  });
  const summary = isDemo
    ? selectedStatement
      ? computeDemoSummary(selectedStatement)
      : null
    : (summaryQuery.data?.data ?? null);

  const selectedLine =
    lines.find((line) => line.id === selectedLineId) ?? null;

  const suggestionsQuery = useQuery({
    queryKey: [...bankQueryRoot, 'line-suggestions', isDemo, selectedLineId],
    queryFn: ({ signal }) =>
      bankStatementLineSuggestions(selectedLineId ?? '', signal),
    enabled: hasScope && !isDemo && Boolean(selectedLineId),
    retry: false,
  });
  const suggestions = isDemo
    ? selectedLineId
      ? createDemoSuggestions()
      : emptySuggestions
    : (suggestionsQuery.data?.data ?? emptySuggestions);

  const createAccount = useMutation({
    mutationFn: async () => {
      if (!isValidName(accountName) || !isValidName(accountBankName))
        throw new Error(t('createAccountError'));
      if (
        accountOpeningBalance.trim() &&
        !isValidSignedDecimal(accountOpeningBalance)
      )
        throw new Error(t('createAccountError'));
      if (isDemo) return `demo-account-${Date.now()}`;
      return bankAccountCreate({
        name: accountName.trim(),
        bankName: accountBankName.trim(),
        currency: accountCurrency,
        clinicId: clinicId ?? '',
        ...(accountOpeningBalance.trim()
          ? { openingBalance: Number(accountOpeningBalance) }
          : {}),
        ...(accountIban.trim() ? { iban: accountIban.trim() } : {}),
        ...(accountNo.trim() ? { accountNo: accountNo.trim() } : {}),
      });
    },
    retry: false,
    onSuccess: async (id) => {
      if (isDemo) {
        const account = createDemoAccount({
          id,
          name: accountName.trim(),
          bankName: accountBankName.trim(),
          currency: accountCurrency,
          openingBalance: accountOpeningBalance.trim()
            ? Number(accountOpeningBalance)
            : 0,
          iban: accountIban.trim() || null,
          accountNo: accountNo.trim() || null,
        });
        setDemoAccounts((current) => [account, ...current]);
      } else {
        await refreshAll();
      }
      setAccountName('');
      setAccountBankName('');
      setAccountOpeningBalance('');
      setAccountIban('');
      setAccountNo('');
      setNotice(t('accountCreated'));
    },
  });

  const archiveAccount = useMutation({
    mutationFn: async (accountId: string) => {
      if (isDemo) return;
      return bankAccountArchive(accountId);
    },
    retry: false,
    onSuccess: async (_result, accountId) => {
      if (isDemo) {
        setDemoAccounts((current) =>
          current.map((account) =>
            account.id === accountId
              ? { ...account, status: 'ARCHIVED' }
              : account
          )
        );
      } else {
        await refreshAll();
      }
      setNotice(t('archived'));
    },
  });

  const importStatement = useMutation({
    mutationFn: async (payload: BankStatementImportPayload | null) => {
      if (!payload || !selectedAccountId) throw new Error(t('importError'));
      if (isDemo) return `demo-statement-${Date.now()}`;
      return bankStatementImport({ bankAccountId: selectedAccountId, ...payload });
    },
    retry: false,
    onSuccess: async (id, payload) => {
      if (!payload) return;
      if (isDemo && selectedAccountId) {
        const statement = createDemoStatement({
          id,
          bankAccountId: selectedAccountId,
          clinicId: clinicId ?? 'demo-clinic',
          periodStart: payload.periodStart,
          periodEnd: payload.periodEnd,
          openingBalance: payload.openingBalance ?? null,
          closingBalance: payload.closingBalance ?? null,
          fileName: payload.fileName ?? null,
          lines: payload.lines,
        });
        setDemoStatements((current) => ({
          ...current,
          [selectedAccountId]: [
            statement,
            ...(current[selectedAccountId] ?? []),
          ],
        }));
        setSelectedStatementId(id);
        setStatementsPage(1);
      } else {
        await refreshAll();
      }
      setPeriodStart('');
      setPeriodEnd('');
      setOpeningBalanceInput('');
      setClosingBalanceInput('');
      setFileName('');
      setLinesRaw('');
      setNotice(t('imported'));
    },
  });

  const buildLegacyPastePayload = (): BankStatementImportPayload | null => {
    if (!periodStart.trim() || !periodEnd.trim()) return null;
    if (
      openingBalanceInput.trim() &&
      !isValidSignedDecimal(openingBalanceInput)
    )
      return null;
    if (
      closingBalanceInput.trim() &&
      !isValidSignedDecimal(closingBalanceInput)
    )
      return null;
    const parsedLines = parseStatementLines(linesRaw);
    if (!parsedLines) return null;

    return {
      periodStart,
      periodEnd,
      ...(openingBalanceInput.trim()
        ? { openingBalance: Number(openingBalanceInput) }
        : {}),
      ...(closingBalanceInput.trim()
        ? { closingBalance: Number(closingBalanceInput) }
        : {}),
      ...(fileName.trim() ? { fileName: fileName.trim() } : {}),
      lines: parsedLines,
    };
  };

  const runAutoMatch = useMutation({
    mutationFn: async () => {
      if (!selectedStatementId) throw new Error(t('autoMatchError'));
      const tolerance = Number(dateToleranceDays);
      if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 15)
        throw new Error(t('autoMatchError'));
      if (isDemo) return;
      return bankStatementAutoMatch(selectedStatementId, {
        dateToleranceDays: tolerance,
      });
    },
    retry: false,
    onSuccess: async () => {
      if (isDemo && selectedAccountId && selectedStatementId) {
        setDemoStatements((current) => {
          const list = current[selectedAccountId] ?? [];
          return {
            ...current,
            [selectedAccountId]: list.map((statement) =>
              statement.id === selectedStatementId
                ? {
                    ...statement,
                    lines: autoMatchDemoLines(statement.lines ?? []),
                  }
                : statement
            ),
          };
        });
      } else {
        await refreshAll();
      }
      setNotice(t('autoMatchDone'));
    },
  });

  const reconcileLine = useMutation({
    mutationFn: async (params: {
      lineId: string;
      matchStatus: ReconcileStatementLineDtoMatchStatus;
      matchedRef?: string | null;
      matchNote?: string | null;
    }) => {
      if (isDemo) return;
      return bankStatementReconcileLine(params.lineId, {
        matchStatus: params.matchStatus,
        matchedRef: params.matchedRef ?? null,
        matchNote: params.matchNote ?? null,
      });
    },
    retry: false,
    onSuccess: async (_result, params) => {
      if (isDemo && selectedAccountId && selectedStatementId) {
        setDemoStatements((current) => {
          const list = current[selectedAccountId] ?? [];
          return {
            ...current,
            [selectedAccountId]: list.map((statement) =>
              statement.id === selectedStatementId
                ? {
                    ...statement,
                    lines: (statement.lines ?? []).map((line) =>
                      line.id === params.lineId
                        ? {
                            ...line,
                            matchStatus: params.matchStatus,
                            matchedRef: params.matchedRef ?? null,
                            matchNote: params.matchNote ?? null,
                            matchSource: 'MANUAL',
                          }
                        : line
                    ),
                  }
                : statement
            ),
          };
        });
      } else {
        await refreshAll();
      }
      setSelectedLineId(null);
      setNotice(t('reconciled'));
    },
  });

  const mutationError =
    errorMessage(createAccount.error) ??
    errorMessage(archiveAccount.error) ??
    errorMessage(importStatement.error) ??
    errorMessage(runAutoMatch.error) ??
    errorMessage(reconcileLine.error);

  const showCreateAccountCard = canCreateAccount && hasScope;
  const showImportCard =
    canImportStatement && hasScope && Boolean(selectedAccountId);
  const showLegacyPasteCard = showImportCard && showAdvancedPaste;

  return {
    hasScope,
    notice,
    mutationError,
    loadError: errorMessage(accountsQuery.error),
    selectedAccountId,
    showCreateAccountCard,
    showImportCard,
    showLegacyPasteCard,

    accountsPanel: {
      hasScope,
      status,
      isLoading: accountsQuery.isPending && !isDemo,
      accounts,
      showArchived,
      onShowArchivedChange: setShowArchived,
      selectedAccountId,
      onSelectAccount: (accountId: string) => {
        setSelectedAccountId(accountId);
        setNotice(null);
      },
      canArchiveAccount,
      onArchiveAccount: (accountId: string) => archiveAccount.mutate(accountId),
      archivePending: archiveAccount.isPending,
    },

    createAccountCard: {
      accountName,
      onAccountNameChange: setAccountName,
      accountBankName,
      onAccountBankNameChange: setAccountBankName,
      accountCurrency,
      onAccountCurrencyChange: setAccountCurrency,
      accountOpeningBalance,
      onAccountOpeningBalanceChange: setAccountOpeningBalance,
      accountIban,
      onAccountIbanChange: setAccountIban,
      accountNo,
      onAccountNoChange: setAccountNo,
      isPending: createAccount.isPending,
      onSubmit: () => {
        setNotice(null);
        createAccount.mutate();
      },
    },

    statementsListCard: {
      hasScope,
      status,
      selectedAccountId,
      selectedAccountCurrency: selectedAccount?.currency,
      isLoading: !isDemo && statementsQuery.isPending,
      statements,
      selectedStatementId,
      onSelectStatement: (statementId: string) => {
        setSelectedStatementId(statementId);
        setNotice(null);
      },
      statementsPage,
      statementsTotalPages,
      onPageChange: setStatementsPage,
    },

    importCard: {
      isSubmitting: importStatement.isPending,
      onImport: async (payload: BankStatementImportPayload) => {
        setNotice(null);
        await importStatement.mutateAsync(payload);
      },
      showAdvancedPaste,
      onToggleAdvancedPaste: () =>
        setShowAdvancedPaste((current) => !current),
    },

    legacyPasteCard: {
      periodStart,
      onPeriodStartChange: setPeriodStart,
      periodEnd,
      onPeriodEndChange: setPeriodEnd,
      openingBalanceInput,
      onOpeningBalanceInputChange: setOpeningBalanceInput,
      closingBalanceInput,
      onClosingBalanceInputChange: setClosingBalanceInput,
      fileName,
      onFileNameChange: setFileName,
      linesRaw,
      onLinesRawChange: setLinesRaw,
      isPending: importStatement.isPending,
      onSubmit: () => {
        setNotice(null);
        importStatement.mutate(buildLegacyPastePayload());
      },
    },

    statementDetailCard: {
      hasScope,
      status,
      selectedStatementId,
      isLoadingStatement: !isDemo && statementDetailQuery.isPending,
      summary,
      selectedAccountCurrency: selectedAccount?.currency,
      canReconcileLine,
      dateToleranceDays,
      onDateToleranceDaysChange: setDateToleranceDays,
      autoMatchPending: runAutoMatch.isPending,
      onRunAutoMatch: () => {
        setNotice(null);
        runAutoMatch.mutate();
      },
      lines,
      reconcilePending: reconcileLine.isPending,
      onViewSuggestions: (lineId: string) => setSelectedLineId(lineId),
      onIgnoreLine: (lineId: string) =>
        reconcileLine.mutate({ lineId, matchStatus: 'IGNORED' }),
      onRevertLine: (lineId: string) =>
        reconcileLine.mutate({ lineId, matchStatus: 'UNMATCHED' }),
      selectedLine,
      suggestionsLoading: !isDemo && suggestionsQuery.isPending,
      suggestions,
      onCloseSuggestions: () => setSelectedLineId(null),
      onUseSuggestion: (matchedRef: string) =>
        selectedLine &&
        reconcileLine.mutate({
          lineId: selectedLine.id,
          matchStatus: 'MATCHED',
          matchedRef,
        }),
    },
  };
}
