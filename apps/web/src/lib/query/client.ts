import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/api';

/**
 * 4xx tekrar denenmez: bunlar isteğin kendisiyle ilgili (yetki yok, kayıt yok,
 * doğrulama düştü) — aynı isteği tekrarlamak aynı cevabı verir, yalnız kullanıcıyı
 * bekletir. 401 zaten istemci katmanında bir kez token yenilemesiyle deneniyor.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiError &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return false;
  }
  return failureCount < 2;
}

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
