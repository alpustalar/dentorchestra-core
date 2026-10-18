'use client';

import { ThemeProvider } from '@/providers/theme-provider';
import { LocaleProvider } from '@/providers/locale-provider';
import { NotificationProvider } from '@/providers/notification-provider';

type Props = {
  children: Readonly<React.ReactNode>;
  locale: string;
};

const Providers = ({ children, locale }: Props) => {
  return (
    <LocaleProvider locale={locale}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <NotificationProvider>{children}</NotificationProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
};

export default Providers;
