'use client';

import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { locales, routing } from '@/i18n/routing';

import { trMessages } from '@/i18n/messages/tr';
import { enMessages } from '@/i18n/messages/en';

const LOCALE_MAP = {
  tr: trMessages,
  en: enMessages,
} as const;

type Props = {
  children: React.ReactNode;
  locale: string;
};

export const LocaleProvider = ({ children, locale }: Props) => {
  const currentLocale = hasLocale(locales, locale)
    ? locale
    : routing.defaultLocale;

  return (
    <NextIntlClientProvider
      locale={currentLocale}
      messages={LOCALE_MAP[currentLocale]}
    >
      {children}
    </NextIntlClientProvider>
  );
};

export default LocaleProvider;
