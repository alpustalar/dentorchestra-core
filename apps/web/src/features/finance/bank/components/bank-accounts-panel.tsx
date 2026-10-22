import type { useTranslations } from 'next-intl';
import { Archive } from 'lucide-react';

import type { BankAccountResponseDto } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatAmount } from '@/features/finance/shared/utils/money-formatter.util';
import type { AuthStatus } from '@/lib/auth';

import { EmptyState } from './bank-ui-primitives';

type Props = {
  t: ReturnType<typeof useTranslations>;
  hasScope: boolean;
  status: AuthStatus;
  isLoading: boolean;
  accounts: BankAccountResponseDto[];
  showArchived: boolean;
  onShowArchivedChange: (showArchived: boolean) => void;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string) => void;
  canArchiveAccount: boolean;
  onArchiveAccount: (accountId: string) => void;
  archivePending: boolean;
};

export function BankAccountsPanel({
  t,
  hasScope,
  status,
  isLoading,
  accounts,
  showArchived,
  onShowArchivedChange,
  selectedAccountId,
  onSelectAccount,
  canArchiveAccount,
  onArchiveAccount,
  archivePending,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('accountsTitle')}</CardTitle>
        <CardDescription>{t('accountsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={!showArchived ? 'default' : 'outline'}
            onClick={() => onShowArchivedChange(false)}
          >
            {t('filterActive')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={showArchived ? 'default' : 'outline'}
            onClick={() => onShowArchivedChange(true)}
          >
            {t('filterAll')}
          </Button>
        </div>

        {!hasScope ? (
          <EmptyState
            label={status === 'unauthenticated' ? t('noSession') : t('noClinic')}
          />
        ) : isLoading ? (
          <EmptyState label={t('loadingStatements')} />
        ) : accounts.length === 0 ? (
          <EmptyState label={t('emptyAccounts')} />
        ) : (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li
                key={account.id}
                className={`rounded-lg border p-3 ${
                  account.id === selectedAccountId ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.bankName} · {account.currency}
                    </p>
                  </div>
                  <Badge variant={account.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                    {t(`status.${account.status}`)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  {formatAmount(account.openingBalance, account.currency)}
                </p>
                <div className="mt-2 flex gap-2">
                  {account.id === selectedAccountId ? (
                    <Badge variant="default">{t('selected')}</Badge>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onSelectAccount(account.id)}
                    >
                      {t('selectAccount')}
                    </Button>
                  )}
                  {canArchiveAccount && account.status === 'ACTIVE' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onArchiveAccount(account.id)}
                      disabled={archivePending}
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
  );
}
