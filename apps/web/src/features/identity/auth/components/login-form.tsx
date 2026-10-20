'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronDown,
  Eye,
  EyeClosed,
  Loader2,
  Smartphone,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  confirmPhoneSignIn,
  createPhoneSignInVerifier,
  requestPhoneSignInCode,
  signIn,
  signInWithGoogle,
} from '@/lib/auth';
import {
  LoginFormSchema,
  type LoginForm as LoginFormValues,
} from '../schemas/login.schema';

export function LoginForm() {
  const router = useRouter();
  const t = useTranslations('Auth.loginForm');
  const [formError, setFormError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSignupHelp, setShowSignupHelp] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCallingCode, setCountryCallingCode] = useState('90');
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] =
    useState<ConfirmationResult | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const phoneVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  /** Firebase hata kodlarını kullanıcıya gösterilebilir metne çevirir. */
  const toReadableMessage = (error: unknown): string => {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : '';

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return t('errors.invalidCredential');
      case 'auth/too-many-requests':
        return t('errors.tooManyRequests');
      case 'auth/network-request-failed':
        return t('errors.network');
      case 'auth/popup-closed-by-user':
        return t('errors.popupClosed');
      case 'auth/popup-blocked':
        return t('errors.popupBlocked');
      case 'auth/invalid-phone-number':
        return t('errors.invalidPhone');
      case 'auth/invalid-verification-code':
        return t('errors.invalidVerificationCode');
      case 'auth/code-expired':
        return t('errors.codeExpired');
      case 'auth/quota-exceeded':
        return t('errors.quotaExceeded');
      default:
        return t('errors.generic');
    }
  };

  useEffect(
    () => () => {
      phoneVerifierRef.current?.clear();
    },
    []
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);

    try {
      await signIn(values.email, values.password);
      navigateAfterSignIn();
    } catch (error) {
      setFormError(toReadableMessage(error));
    }
  });

  const navigateAfterSignIn = () => {
    router.replace('/');
    router.refresh();
  };

  const onGoogleLogin = async () => {
    setFormError(null);
    setGoogleLoading(true);

    try {
      await signInWithGoogle();
      navigateAfterSignIn();
    } catch (error) {
      setFormError(toReadableMessage(error));
    } finally {
      setGoogleLoading(false);
    }
  };

  const onPhoneSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const localPhoneNumber = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
    const normalizedPhoneNumber = `+${countryCallingCode}${localPhoneNumber}`;
    if (
      !phoneConfirmation &&
      (!localPhoneNumber || !/^\+[1-9]\d{7,14}$/.test(normalizedPhoneNumber))
    ) {
      setFormError(t('validation.phone'));
      return;
    }

    if (phoneConfirmation && !/^\d{6}$/.test(verificationCode.trim())) {
      setFormError(t('validation.verificationCode'));
      return;
    }

    setPhoneLoading(true);
    try {
      if (phoneConfirmation) {
        await confirmPhoneSignIn(phoneConfirmation, verificationCode.trim());
        navigateAfterSignIn();
        return;
      }

      const recaptchaContainer = recaptchaContainerRef.current;
      if (!recaptchaContainer) {
        setFormError(t('errors.phoneInitialization'));
        return;
      }

      const verifier = createPhoneSignInVerifier(recaptchaContainer);
      phoneVerifierRef.current = verifier;
      const confirmation = await requestPhoneSignInCode(
        normalizedPhoneNumber,
        verifier
      );
      verifier.clear();
      phoneVerifierRef.current = null;
      setPhoneConfirmation(confirmation);
      setVerificationCode('');
    } catch (error) {
      phoneVerifierRef.current?.clear();
      phoneVerifierRef.current = null;
      setFormError(toReadableMessage(error));
    } finally {
      setPhoneLoading(false);
    }
  };

  const changeLoginMethod = (method: 'email' | 'phone') => {
    setLoginMethod(method);
    setPhoneConfirmation(null);
    setVerificationCode('');
    setFormError(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-semibold tracking-tight">
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full gap-3 bg-white font-medium text-black hover:bg-neutral-100 hover:text-black dark:bg-white dark:text-black dark:hover:bg-neutral-100"
          disabled={isSubmitting || googleLoading || phoneLoading}
          onClick={onGoogleLogin}
        >
          {googleLoading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.75 3.27-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.99 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.85A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.04H2.16a11 11 0 0 0 0 9.92l3.69-2.85Z" />
              <path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.84 6.04l3.69 2.85C6.72 7.29 9.14 5.36 12 5.36Z" />
            </svg>
          )}
          {t('continueWithGoogle')}
        </Button>

        <div className="relative flex items-center">
          <div className="h-px flex-1 bg-border" />
          <span className="px-3 text-xs text-muted-foreground">
            {t('or')}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            aria-pressed={loginMethod === 'email'}
            disabled={isSubmitting || googleLoading || phoneLoading}
            onClick={() => changeLoginMethod('email')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              loginMethod === 'email'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('email')}
          </button>
          <button
            type="button"
            aria-pressed={loginMethod === 'phone'}
            disabled={isSubmitting || googleLoading || phoneLoading}
            onClick={() => changeLoginMethod('phone')}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              loginMethod === 'phone'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('phone')}
          </button>
        </div>

        {loginMethod === 'email' ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                {t('email')}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {t('validation.email')}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-medium">
                {t('password')}
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  aria-invalid={Boolean(errors.password)}
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? t('hidePassword') : t('showPassword')
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  {showPassword ? (
                    <Eye className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeClosed className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-sm">
                  {t('validation.password')}
                </p>
              )}
            </div>

            {formError && (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            )}

            <Button
              type="submit"
              className="h-10 w-full bg-black text-white hover:bg-neutral-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:hover:text-black"
              disabled={isSubmitting || googleLoading || phoneLoading}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              {t('login')}
            </Button>
          </form>
        ) : (
          <form onSubmit={onPhoneSubmit} className="flex flex-col gap-4">
            {phoneConfirmation ? (
              <div className="flex flex-col gap-2">
                <label htmlFor="verification-code" className="text-sm font-medium">
                  {t('smsVerificationCode')}
                </label>
                <Input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) =>
                    setVerificationCode(
                      event.target.value.replace(/\D/g, '').slice(0, 6)
                    )
                  }
                  placeholder="123456"
                  aria-invalid={Boolean(formError)}
                />
                <button
                  type="button"
                  onClick={() => changeLoginMethod('phone')}
                  className="self-start text-xs font-medium text-primary hover:underline"
                >
                  {t('changePhoneNumber')}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  {t('phoneNumber')}
                </label>
                <div className="flex">
                  <div className="relative w-[6.5rem] shrink-0">
                    <select
                      aria-label={t('countryCode')}
                      autoComplete="tel-country-code"
                      value={countryCallingCode}
                      onChange={(event) =>
                        setCountryCallingCode(event.target.value)
                      }
                      className="h-8 w-full appearance-none rounded-l-lg border border-input bg-background py-1 pl-2 pr-8 text-sm text-foreground outline-none focus-visible:z-10 focus-visible:outline-none focus-visible:ring-0"
                    >
                      <option value="90">🇹🇷 +90</option>
                      <option value="1">🇺🇸 +1</option>
                      <option value="44">🇬🇧 +44</option>
                      <option value="49">🇩🇪 +49</option>
                      <option value="33">🇫🇷 +33</option>
                      <option value="31">🇳🇱 +31</option>
                      <option value="994">🇦🇿 +994</option>
                      <option value="357">🇨🇾 +357</option>
                      <option value="966">🇸🇦 +966</option>
                      <option value="971">🇦🇪 +971</option>
                      <option value="91">🇮🇳 +91</option>
                      <option value="61">🇦🇺 +61</option>
                      <option value="34">🇪🇸 +34</option>
                      <option value="39">🇮🇹 +39</option>
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel-national"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="5xx xxx xx xx"
                    aria-invalid={Boolean(formError)}
                    className="rounded-l-none border-l-0 outline-none focus-visible:border-input focus-visible:ring-0 aria-invalid:border-input aria-invalid:ring-0"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('phoneHint')}
                </p>
              </div>
            )}

            {formError && (
              <p role="alert" className="text-destructive text-sm">
                {formError}
              </p>
            )}

            <Button
              type="submit"
              className="h-10 w-full bg-black text-white hover:bg-neutral-800 hover:text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100 dark:hover:text-black"
              disabled={phoneLoading || googleLoading || isSubmitting}
            >
              {phoneLoading ? (
                <Loader2 className="animate-spin" />
              ) : phoneConfirmation ? (
                t('login')
              ) : (
                <>
                  <Smartphone />
                  {t('sendSmsCode')}
                </>
              )}
            </Button>
          </form>
        )}
        <div className="border-t border-border pt-4 text-center text-sm">
          <span className="text-muted-foreground">
            {t('signUpPrompt')}
          </span>{' '}
          <button
            type="button"
            onClick={() => setShowSignupHelp((shown) => !shown)}
            className="font-medium text-primary hover:underline"
          >
            {t('signUp')}
          </button>
          {showSignupHelp && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {t('signUpHelp')}
            </p>
          )}
        </div>
        <div
          ref={recaptchaContainerRef}
          className="absolute"
          aria-hidden="true"
        />
      </CardContent>
    </Card>
  );
}
