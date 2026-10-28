'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Loader2, Plug, Unplug } from 'lucide-react';
import type { MetaAdAccountResponse } from '@dentorchestra/shared/client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { useConnectMetaAccount } from '../api/use-meta-oauth';
import { useDisconnectMetaAccount } from '../api/use-meta-ad-accounts';
import { EmptyState, errorMessage, formatDateTime, Notice } from './panel-ui';

interface ConnectionPanelProps {
  clinicId: string;
  accounts: MetaAdAccountResponse[];
  isLoading: boolean;
  isError: boolean;
  canManage: boolean;
  isDemo: boolean;
}

export function ConnectionPanel({
  clinicId,
  accounts,
  isLoading,
  isError,
  canManage,
  isDemo,
}: ConnectionPanelProps) {
  const t = useTranslations('MetaAds');
  const locale = useLocale();
  const pathname = usePathname();
  const connectMutation = useConnectMetaAccount();
  const disconnectMutation = useDisconnectMetaAccount(clinicId);

  const handleConnect = () => {
    if (isDemo) return;
    connectMutation.mutate({ clinicId, returnPath: pathname });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t('connectionTitle')}</CardTitle>
          <CardDescription>{t('connectionDescription')}</CardDescription>
        </div>
        <Button
          type="button"
          onClick={handleConnect}
          disabled={isDemo || !canManage || connectMutation.isPending}
        >
          {connectMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plug className="size-4" aria-hidden="true" />
          )}
          {connectMutation.isPending ? t('connecting') : t('connectButton')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {connectMutation.isError && (
          <Notice
            error
            message={errorMessage(connectMutation.error) ?? t('connectError')}
          />
        )}
        {disconnectMutation.isError && (
          <Notice
            error
            message={errorMessage(disconnectMutation.error) ?? t('disconnectError')}
          />
        )}
        {isError && <Notice error message={t('accountsLoadError')} />}

        {isLoading ? (
          <EmptyState label={t('loading')} />
        ) : accounts.length === 0 ? (
          <EmptyState label={t('noAccounts')} />
        ) : (
          <div className="flex flex-col gap-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {account.businessName || t('accountBusinessNameFallback')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.adAccountId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.lastSyncAt
                      ? t('lastSyncAt', {
                          date: formatDateTime(String(account.lastSyncAt), locale),
                        })
                      : t('lastSyncNever')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={account.isActive ? 'secondary' : 'outline'}>
                    {account.isActive
                      ? t('accountStatusActive')
                      : t('accountStatusInactive')}
                  </Badge>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => disconnectMutation.mutate(account.id)}
                      disabled={isDemo || disconnectMutation.isPending}
                    >
                      <Unplug className="size-4" aria-hidden="true" />
                      {t('disconnectButton')}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
