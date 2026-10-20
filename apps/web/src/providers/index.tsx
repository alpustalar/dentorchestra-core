'use client';

import { useEffect } from 'react';
import { ThemeProvider } from '@/providers/theme-provider';
import { LocaleProvider } from '@/providers/locale-provider';
import { NotificationProvider } from '@/providers/notification-provider';
import { QueryProvider } from '@/lib/query';
import { useAuth } from '@/data/auth/auth-context';
import { ApiMockProvider } from '@/providers/api-mock-provider';

type Props = {
  children: Readonly<React.ReactNode>;
  locale: string;
};

const Providers = ({ children, locale }: Props) => {
  useEffect(() => {
    void useAuth.persist.rehydrate();
  }, []);

  return (
    <LocaleProvider locale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <QueryProvider>
          <ApiMockProvider>
            <NotificationProvider>{children}</NotificationProvider>
          </ApiMockProvider>
        </QueryProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
};

export default Providers;
