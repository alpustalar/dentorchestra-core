import * as rootParams from 'next/root-params';
import { getRequestConfig } from 'next-intl/server';
import { trMessages } from '@/i18n/messages/tr';
import { enMessages } from '@/i18n/messages/en';
import { locales, routing } from '@/i18n/routing';
import { hasLocale } from 'next-intl';

const locale_map = {
  tr: trMessages,
  en: enMessages,
} as const;

export default getRequestConfig(async () => {
  const explicitLocale = await rootParams.locale();

  const locale = hasLocale(locales, explicitLocale)
    ? explicitLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: locale_map[locale],
    formats: {
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
      },
      number: {
        precise: {
          maximumFractionDigits: 5,
        },
      },
      list: {
        enumeration: {
          style: 'long',
          type: 'conjunction',
        },
      },
      displayName: {
        region: {
          type: 'region',
        },
      },
    },
  };
});
