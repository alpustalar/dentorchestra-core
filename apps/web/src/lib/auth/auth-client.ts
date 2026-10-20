'use client';

import {
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';

import { setTokenProvider } from '@/lib/api';

import { assertFirebaseConfigured, getFirebaseAuth } from './firebase';

/**
 * Çerezi Next route handler'ı üzerinden tazeler. Çerez `httpOnly` olduğu için
 * tarayıcıdan doğrudan yazılamaz — zaten istenen de bu (XSS ile okunamasın).
 */
async function syncSessionCookie(token: string | null): Promise<void> {
  await fetch('/api/auth/session', {
    method: token ? 'POST' : 'DELETE',
    headers: token ? { 'Content-Type': 'application/json' } : undefined,
    body: token ? JSON.stringify({ token }) : undefined,
  });
}

export async function signIn(email: string, password: string): Promise<void> {
  assertFirebaseConfigured();

  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email,
    password
  );

  await syncSessionCookie(await credential.user.getIdToken());
}

export async function signInWithGoogle(): Promise<void> {
  assertFirebaseConfigured();

  const credential = await signInWithPopup(
    getFirebaseAuth(),
    new GoogleAuthProvider()
  );

  await syncSessionCookie(await credential.user.getIdToken());
}

export function createPhoneSignInVerifier(
  container: HTMLElement
): RecaptchaVerifier {
  assertFirebaseConfigured();
  return new RecaptchaVerifier(getFirebaseAuth(), container, {
    size: 'invisible',
  });
}

export async function requestPhoneSignInCode(
  phoneNumber: string,
  verifier: RecaptchaVerifier
) {
  assertFirebaseConfigured();
  return signInWithPhoneNumber(getFirebaseAuth(), phoneNumber, verifier);
}

export async function confirmPhoneSignIn(
  confirmation: Awaited<ReturnType<typeof requestPhoneSignInCode>>,
  verificationCode: string
): Promise<void> {
  const credential = await confirmation.confirm(verificationCode);
  await syncSessionCookie(await credential.user.getIdToken());
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
  await syncSessionCookie(null);
}

export function watchAuthState(
  onChange: (user: User | null) => void
): () => void {
  return onAuthStateChanged(getFirebaseAuth(), onChange);
}

/**
 * API istemcisine token kaynağını tanıtır. Uygulama açılışında bir kez çağrılır
 * (`AuthProvider`); `lib/api` böylece Firebase'i hiç import etmeden token bulur.
 */
export function registerTokenProvider(onSignedOut: () => void): void {
  setTokenProvider({
    async getToken(forceRefresh = false) {
      const user = getFirebaseAuth().currentUser;
      if (!user) return null;

      const token = await user.getIdToken(forceRefresh);

      // Zorla yenilediysek çerez de bayatlamıştır; sunucu tarafı aynı token'ı
      // görsün diye eşitliyoruz.
      if (forceRefresh) await syncSessionCookie(token);

      return token;
    },

    async onUnauthorized() {
      await signOut();
      onSignedOut();
    },
  });
}
