'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Landmark } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useAuth as useMockAuth } from '@/data/auth/auth-context';
import {
  useBankWorkspace,
  type BankWorkspaceCapabilities,
} from '@/features/finance/bank/hooks/use-bank-workspace';
import {
  actorHasCapability,
  AuthProvider,
  useAuth,
  type AuthStatus,
} from '@/lib/auth';

import { BankAccountsPanel } from './bank-accounts-panel';
import { BankCreateAccountCard } from './bank-create-account-card';
import { BankLegacyPasteCard } from './bank-legacy-paste-card';
import { BankStatementDetailCard } from './bank-statement-detail-card';
import { BankStatementImportCard } from './bank-statement-import-card';
import { BankStatementsListCard } from './bank-statements-list-card';
import { Notice } from './bank-ui-primitives';

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

export function BankWorkspace() {
  if (mockingEnabled) return <MockBank />;

  return (
    <AuthProvider>
      <LiveBank />
    </AuthProvider>
  );
}

function MockBank() {
  const { selectedClinicId, hasHydrated } = useMockAuth();

  return (
    <BankContent
      clinicId={selectedClinicId}
      status={hasHydrated ? 'authenticated' : 'loading'}
      canCreateAccount
      canArchiveAccount
      canImportStatement
      canReconcileLine
      isDemo
    />
  );
}

function LiveBank() {
  const { actor, status } = useAuth();

  return (
    <BankContent
      clinicId={actor?.clinicId ?? null}
      status={status}
      canCreateAccount={actorHasCapability(actor, 'bankaccount:create')}
      canArchiveAccount={actorHasCapability(actor, 'bankaccount:delete')}
      canImportStatement={actorHasCapability(actor, 'bankstatement:create')}
      canReconcileLine={actorHasCapability(actor, 'bankstatementline:update')}
      isDemo={false}
    />
  );
}

function BankContent({
  clinicId,
  status,
  canCreateAccount,
  canArchiveAccount,
  canImportStatement,
  canReconcileLine,
  isDemo,
}: BankWorkspaceCapabilities & {
  clinicId: string | null;
  status: AuthStatus;
  isDemo: boolean;
}) {
  const t = useTranslations('FinanceBank');
  const locale = useLocale();

  const bank = useBankWorkspace({
    clinicId,
    status,
    isDemo,
    canCreateAccount,
    canArchiveAccount,
    canImportStatement,
    canReconcileLine,
    t,
  });

  return (
    <main className="space-y-6 p-6 md:p-8">
      <header>
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Landmark className="size-4" aria-hidden="true" />
          <span>{t('eyebrow')}</span>
          {isDemo && <Badge variant="outline">{t('demoData')}</Badge>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {bank.hasScope
            ? t('description')
            : status === 'unauthenticated'
              ? t('noSession')
              : t('noClinic')}
        </p>
      </header>

      {(bank.mutationError || bank.loadError) && (
        <Notice
          message={bank.mutationError ?? bank.loadError ?? t('loadError')}
          error
        />
      )}
      {bank.notice && <Notice message={bank.notice} />}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <BankAccountsPanel t={t} {...bank.accountsPanel} />

          {bank.showCreateAccountCard && (
            <BankCreateAccountCard t={t} {...bank.createAccountCard} />
          )}
        </div>

        <div className="space-y-6">
          <BankStatementsListCard
            t={t}
            locale={locale}
            {...bank.statementsListCard}
          />

          {bank.showImportCard && bank.selectedAccountId && (
            <BankStatementImportCard
              t={t}
              bankAccountId={bank.selectedAccountId}
              {...bank.importCard}
            />
          )}

          {bank.showLegacyPasteCard && (
            <BankLegacyPasteCard t={t} {...bank.legacyPasteCard} />
          )}

          <BankStatementDetailCard
            t={t}
            locale={locale}
            {...bank.statementDetailCard}
          />
        </div>
      </div>
    </main>
  );
}
