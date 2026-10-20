/*
 * DİKKAT: `session.server.ts` bilerek buradan dışa açılmıyor. İçinde
 * `server-only` var; bu barrel'a girerse onu import eden her istemci bileşeni
 * derleme hatasıyla düşer. Sunucu tarafı onu doğrudan import eder.
 */
export { AuthProvider, useAuth, actorKeys, type AuthStatus } from './auth-provider';
export {
  actorHasCapability,
  useAnyCapability,
  useCapability,
} from './use-capability';
export {
  confirmPhoneSignIn,
  createPhoneSignInVerifier,
  requestPhoneSignInCode,
  signIn,
  signInWithGoogle,
  signOut,
  watchAuthState,
} from './auth-client';
export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from './session';
