'use client';

import { WifiOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useNetworkStatus } from '@/lib/network';

export function OfflineStatusBanner() {
  const t = useTranslations('Connectivity');
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex w-full max-w-3xl items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-50/95 px-4 py-3 text-amber-950 shadow-lg backdrop-blur dark:bg-amber-950/95 dark:text-amber-50">
        <WifiOff className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t('offlineTitle')}</p>
          <p className="mt-0.5 text-xs opacity-80">{t('offlineDescription')}</p>
        </div>
      </div>
    </div>
  );
}
