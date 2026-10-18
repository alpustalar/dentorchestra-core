import { defineRouting } from 'next-intl/routing';

export const locales = ['tr', 'en'] as const;

export type Locale = (typeof locales)[keyof typeof locales];

export const routing = defineRouting({ locales, defaultLocale: 'tr' });
