'use client';

import { useState } from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useRouter } from '@/i18n/navigation';
import { registerTokenProvider } from '@/lib/auth/auth-client';

import { makeQueryClient } from './client';
import {
  makeOfflineQueryPersister,
  OFFLINE_QUERY_CACHE_BUSTER,
  OFFLINE_QUERY_CACHE_MAX_AGE,
} from './offline-cache';

/**
 * `useState` ile bir kez kuruluyor — modül düzeyinde tutulsaydı sunucu tarafı
 * render'da tüm kullanıcılar aynı cache'i paylaşırdı.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(makeOfflineQueryPersister);
  const router = useRouter();

  // Register before rendering query consumers so Orval hooks can attach the
  // Firebase token on their first request. The auth provider clears cached data
  // and returns to login if the refreshed token is still rejected.
  useState(() => {
    registerTokenProvider(() => {
      queryClient.clear();
      router.replace('/login');
    });
    return true;
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        buster: OFFLINE_QUERY_CACHE_BUSTER,
        maxAge: OFFLINE_QUERY_CACHE_MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && query.meta?.persist === true,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
