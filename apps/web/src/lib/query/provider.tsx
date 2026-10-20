'use client';

import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from '@/i18n/navigation';
import { registerTokenProvider } from '@/lib/auth/auth-client';

import { makeQueryClient } from './client';

/**
 * `useState` ile bir kez kuruluyor — modül düzeyinde tutulsaydı sunucu tarafı
 * render'da tüm kullanıcılar aynı cache'i paylaşırdı.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
