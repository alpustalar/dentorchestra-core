'use client';

import { Activity } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { LoginForm } from '@/features/identity/auth/components/login-form';
import { APP } from '@/constants';
import { SettingsMenu } from '@/components/layout/dashboard/topbar/settings-menu';
import { useTopbarSettings } from '@/components/layout/dashboard/hooks/use-topbar-settings';
import { DateTimeManager } from '@shared/common';

export default function LoginPage() {
  const t = useTranslations('Auth.loginForm');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    accent,
    setAccent,
    contrast,
    setContrast,
    persistSettings,
    updatePersistence,
  } = useTopbarSettings();

  return (
    <main className="min-h-svh bg-background lg:grid lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]">
      <aside className="relative hidden min-h-svh overflow-hidden bg-[#111827] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -left-32 -top-28 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-48 -right-24 size-[34rem] rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.07)_1px,transparent_0)] bg-[size:28px_28px] opacity-40" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Activity className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-wide">
            {APP.NAME}
          </span>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-xl py-12 text-white">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
            {t('platformLabel')}
          </p>
          <h1 className="max-w-lg text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
            {t('heroDescription')}
          </p>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          © {DateTimeManager.currentYear()} {APP.NAME}
        </p>
      </aside>

      <section className="flex min-h-svh flex-col px-5 py-10 sm:px-8 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-[1.15rem]" />
            </div>
            <span className="font-semibold">{APP.NAME}</span>
          </div>
          <SettingsMenu
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            buttonSize="lg"
            accent={accent}
            setAccent={setAccent}
            contrast={contrast}
            setContrast={setContrast}
            persistSettings={persistSettings}
            updatePersistence={updatePersistence}
          />
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">
            <LoginForm />
            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              {t('terms')}
            </p>
          </div>
        </div>

        <footer className="text-center text-xs text-muted-foreground">
          {t('footer')}
        </footer>
      </section>
    </main>
  );
}
