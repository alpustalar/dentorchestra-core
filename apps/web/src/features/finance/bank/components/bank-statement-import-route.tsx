'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { bankStatementImport } from '@/api/generated/bank-statement-command/bank-statement-command';
import { Button } from '@/components/ui/button';
import ManagedDialog from '@/components/ui/managed-dialog';

import {
  BankStatementImportWizard,
  type BankStatementImportPayload,
} from './bank-statement-import-wizard';

const bankQueryRoot = ['finance', 'bank'] as const;

function useRouteImport(bankAccountId: string, onComplete: () => void) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: BankStatementImportPayload) =>
      bankStatementImport({ bankAccountId, ...payload }),
    retry: false,
  });

  return {
    isSubmitting: mutation.isPending,
    onImport: async (payload: BankStatementImportPayload) => {
      await mutation.mutateAsync(payload);
      await queryClient.invalidateQueries({ queryKey: bankQueryRoot });
    },
    onComplete,
  };
}

function ImportContent({
  bankAccountId,
  onComplete,
}: {
  bankAccountId: string;
  onComplete: () => void;
}) {
  const t = useTranslations('FinanceBank');
  const importProps = useRouteImport(bankAccountId, onComplete);

  if (!bankAccountId) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t('importWizard.missingAccount')}
        </p>
        <Button type="button" variant="outline" onClick={onComplete}>
          {t('importWizard.returnToBank')}
        </Button>
      </div>
    );
  }

  return (
    <BankStatementImportWizard bankAccountId={bankAccountId} {...importProps} />
  );
}

export function BankStatementImportModal({
  bankAccountId,
}: {
  bankAccountId: string;
}) {
  const router = useRouter();
  const t = useTranslations('FinanceBank');
  const close = () => router.back();

  return (
    <ManagedDialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      labels={{
        close: t('importWizard.modal.close'),
        settings: t('importWizard.modal.settings'),
        settingsTitle: t('importWizard.modal.settingsTitle'),
        dismissOnOutside: t('importWizard.modal.dismissOnOutside'),
        dismissOnOutsideDescription: t(
          'importWizard.modal.dismissOnOutsideDescription'
        ),
        dismissEnabledStatus: t('importWizard.modal.dismissEnabledStatus'),
        dismissDisabledStatus: t('importWizard.modal.dismissDisabledStatus'),
      }}
    >
      <ManagedDialog.Header
        title={t('importTitle')}
        description={t('importDescription')}
      >
        <ManagedDialog.Settings />
        <ManagedDialog.Close />
      </ManagedDialog.Header>
      <ManagedDialog.Content className="flex min-h-0 flex-1 flex-col">
        <ImportContent bankAccountId={bankAccountId} onComplete={close} />
      </ManagedDialog.Content>
    </ManagedDialog>
  );
}

export function BankStatementImportPage({
  bankAccountId,
}: {
  bankAccountId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('FinanceBank');
  const returnToBank = () =>
    router.replace(pathname.replace(/\/import-csv$/, ''));

  return (
    <main className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <section className="flex min-h-[min(760px,calc(100dvh-10rem))] flex-col overflow-hidden rounded-xl border bg-background shadow-sm">
        <header className="border-b px-5 py-5">
          <h1 className="text-xl font-semibold">{t('importTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('importDescription')}
          </p>
        </header>
        <ImportContent
          bankAccountId={bankAccountId}
          onComplete={returnToBank}
        />
      </section>
    </main>
  );
}
