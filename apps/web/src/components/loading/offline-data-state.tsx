'use client';

import { DatabaseZap } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function OfflineDataState() {
  const t = useTranslations('Connectivity');

  return (
    <div className="rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <DatabaseZap className="mx-auto size-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-medium">{t('noCachedDataTitle')}</p>
      <p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">
        {t('noCachedDataDescription')}
      </p>
    </div>
  );
}
