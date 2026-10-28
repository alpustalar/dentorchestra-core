'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from 'firebase/auth';
import {
  meEndpoints,
  type ActorContextResponse,
} from '@dentorchestra/shared/client';

import { api } from '@/lib/api';

import {
  registerTokenProvider,
  signOut as firebaseSignOut,
  watchAuthState,
} from './auth-client';

export const actorKeys = {
  context: () => ['actor', 'context'] as const,
};

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  /** `status === 'authenticated'` olmadan `null`. */
  actor: ActorContextResponse | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // `undefined` = Firebase henüz cevap vermedi, `null` = oturum yok.
  // İkisini ayırmak şart: ayırmazsak ilk render'da herkesi çıkışa yollarız.
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(
    undefined
  );

  useEffect(() => {
    registerTokenProvider(() => {
      queryClient.clear();
      router.replace('/login');
    });

    return watchAuthStateSafely(setFirebaseUser);
  }, [queryClient, router]);

  const {
    data: actor,
    isPending,
    isError,
  } = useQuery({
    queryKey: actorKeys.context(),
    queryFn: () => api(meEndpoints.context),
    enabled: Boolean(firebaseUser),
    // Yetki sınırları oturum boyunca değişmez; rol değişirse kullanıcı zaten
    // yeniden giriş yapar. Her odaklanmada yeniden çekmenin anlamı yok.
    staleTime: Infinity,
    retry: false,
  });

  const status: AuthStatus = (() => {
    if (firebaseUser === undefined) return 'loading';
    if (firebaseUser === null || isError) return 'unauthenticated';
    return isPending ? 'loading' : 'authenticated';
  })();

  const value: AuthContextValue = {
    status,
    actor: status === 'authenticated' ? (actor ?? null) : null,
    signOut: async () => {
      await firebaseSignOut();
      queryClient.clear();
      router.replace('/login');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Firebase yapılandırması eksikse `watchAuthState` fırlatır. Yakalamazsak eksik
 * bir `.env.local` bütün uygulamayı beyaz ekrana düşürür — oysa doğru davranış
 * "oturum yok"a düşüp giriş ekranını göstermek.
 */
function watchAuthStateSafely(
  onChange: (user: User | null) => void
): (() => void) | undefined {
  try {
    return watchAuthState(onChange);
  } catch (error) {
    console.error('[auth] Firebase başlatılamadı:', error);
    onChange(null);
    return undefined;
  }
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth yalnız <AuthProvider> içinde kullanılabilir.');
  }

  return context;
}
