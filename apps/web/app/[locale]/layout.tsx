import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { hasLocale } from 'next-intl';
import { Geist, Geist_Mono } from 'next/font/google';
import { routing } from '@/i18n/routing';
import Providers from '@/providers';
import '../globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'MedERP — Klinik Yönetim Paneli',
  description:
    'Diş, saç ekimi ve estetik cerrahi klinikleri için bütünleşik ERP paneli',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  const requestedLocale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  return (
    <html
      lang={requestedLocale}
      suppressHydrationWarning
      className={`bg-background ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Providers locale={locale}>{children}</Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
