'use client';

import * as React from 'react';
import {
  useParams,
  usePathname,
  useRouter,
  useSelectedLayoutSegments,
} from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, RefreshCw, X } from 'lucide-react';

import { navGroups } from '@/constants/navigation/sidebar-nav';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { cn } from '@/lib/utils';

type PageTab = {
  href: string;
  label: string;
};

const STORAGE_KEY = 'dashboard-page-tabs';
const SUPPORTED_LOCALES = new Set(['tr', 'en']);
const CLINIC_SLUGS = new Set([
  ...clinics.map((clinic) => clinic.slug),
  'all-clinics',
]);

function getTabLabel(
  pathname: string,
  translate: (key: string) => string,
  clinicSlug: string
) {
  const normalizedHref = normalizeHref(pathname);
  const segments = normalizedHref.split('/').filter(Boolean);
  const href =
    segments.length > 0 && CLINIC_SLUGS.has(segments[0])
      ? `/${segments.slice(1).join('/')}` || '/'
      : normalizedHref;
  const navRoutes = navGroups.flatMap((group) =>
    group.items.flatMap((item) => [
      { href: `/${item.href}`, translationKey: item.translationKey },
      ...(item.children ?? []).map((child) => ({
        href: `/${child.href}`,
        translationKey: child.translationKey,
      })),
    ])
  );
  const legacyRoutes: Record<string, string> = {
    '/appointments': 'Navigation.items.appointments',
    '/patients': 'Navigation.items.patients',
    '/inbox': 'Navigation.items.conversations',
    '/crm': 'Navigation.items.leads',
    '/finance': 'Navigation.items.accounting',
    '/inventory': 'Navigation.items.inventory',
    '/marketing': 'Navigation.items.metaAds',
    '/workforce': 'Navigation.items.employees',
    '/notifications': 'Navigation.items.notifications',
    '/platform-administration': 'Navigation.items.platformAdministration',
    '/automations': 'Navigation.items.automations',
  };
  const page = [
    ...navRoutes,
    ...Object.entries(legacyRoutes).map(([route, translationKey]) => ({
      href: route,
      translationKey,
    })),
  ]
    .filter((route) => route.href !== '/')
    .sort((left, right) => right.href.length - left.href.length)
    .find(({ href: routeHref }) => href === routeHref || href.startsWith(`${routeHref}/`));

  if (page) return translate(page.translationKey);
  if (href === '/') return translate('Navigation.items.overview');

  const pageSegment = href.split('/').filter(Boolean).at(-1) ?? '';
  return decodeURIComponent(pageSegment)
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function readStoredTabs(): PageTab[] {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    const tabs: unknown = stored ? JSON.parse(stored) : [];

    if (!Array.isArray(tabs)) return [];

    return tabs.filter(
      (tab): tab is PageTab =>
        typeof tab === 'object' &&
        tab !== null &&
        'href' in tab &&
        typeof tab.href === 'string' &&
        'label' in tab &&
        typeof tab.label === 'string'
    ).map((tab) => ({ ...tab, href: normalizeHref(tab.href) }));
  } catch {
    return [];
  }
}

function normalizeHref(href: string) {
  const segments = href.split('/').filter(Boolean);
  if (segments.length > 0 && SUPPORTED_LOCALES.has(segments[0])) {
    return `/${segments.slice(1).join('/')}` || '/';
  }
  return href || '/';
}

function localizedHref(href: string, locale: string, clinicSlug: string) {
  if (href === '/') return `/${locale}/${clinicSlug}`;

  const path = href.startsWith('/') ? href : `/${href}`;
  const firstSegment = path.split('/').filter(Boolean)[0];
  return firstSegment && CLINIC_SLUGS.has(firstSegment)
    ? `/${locale}${path}`
    : `/${locale}/${clinicSlug}${path}`;
}

export function PageTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const params = useParams<{ 'clinic-slug': string }>();
  const clinicSlug = params['clinic-slug'] ?? 'fethiye';
  const translate = useTranslations();
  
  // Next.js segment hook'u (URL kırılımlarını dizi olarak verir)
  const segments = useSelectedLayoutSegments();

  const [tabs, setTabs] = React.useState<PageTab[]>([]);
  const [initialized, setInitialized] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const skipNextPathRef = React.useRef(false);

  React.useEffect(() => {
    setTabs(readStoredTabs());
    setInitialized(true);
  }, []);

  React.useEffect(() => {
    if (!initialized) return;

    const href = normalizeHref(pathname);
    if (skipNextPathRef.current) {
      skipNextPathRef.current = false;
      return;
    }

    setTabs((currentTabs) => {
      const existingTab = currentTabs.find((tab) => tab.href === href);
      const translatedTabs = currentTabs.map((tab) => ({
        ...tab,
        label: getTabLabel(tab.href, translate, clinicSlug),
      }));
      const nextTabs = existingTab
        ? translatedTabs
        : [
            ...translatedTabs,
            { href, label: getTabLabel(href, translate, clinicSlug) },
          ];

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextTabs));
      return nextTabs;
    });
  }, [clinicSlug, initialized, pathname, translate, segments]);

  const closeTab = (href: string) => {
    const index = tabs.findIndex((tab) => tab.href === href);
    const nextTabs = tabs.filter((tab) => tab.href !== href);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextTabs));
    setTabs(nextTabs);

    if (normalizeHref(pathname) === href) {
      const nextTab = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0];
      if (nextTab) {
        router.push(localizedHref(nextTab.href, locale, clinicSlug));
      } else {
        router.push(localizedHref('/', locale, clinicSlug));
      }
    }
  };

  const closeAllTabs = () => {
    skipNextPathRef.current = true;
    sessionStorage.removeItem(STORAGE_KEY);
    setTabs([]);
    setMenuOpen(false);
    router.push(localizedHref('/', locale, clinicSlug));
  };

  const refreshCurrentTab = () => {
    setMenuOpen(false);
    router.refresh();
  };

  if (!initialized || tabs.length === 0) return null;

  return (
    <nav
      aria-label={translate('Navigation.openPages')}
      className="relative flex h-11 shrink-0 items-end border-b border-border bg-background"
    >
      <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto px-3 md:px-5">
        {tabs.map((tab) => {
          const isActive = tab.href === normalizeHref(pathname);

          return (
            <div
              key={tab.href}
              className={cn(
                'group flex h-9 max-w-56 min-w-32 items-center gap-2 rounded-t-md border border-b-0 px-3 text-sm transition-colors',
                isActive
                  ? 'border-border bg-muted/40 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(localizedHref(tab.href, locale, clinicSlug))
                }
                className="min-w-0 flex-1 truncate text-left"
                aria-current={isActive ? 'page' : undefined}
                title={tab.label}
              >
                {tab.label}
              </button>
              <button
                type="button"
                onClick={() => closeTab(tab.href)}
                aria-label={translate('Navigation.closePage', { page: tab.label })}
                className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative flex h-full shrink-0 items-center border-l border-border bg-background px-2">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label={translate('Navigation.tabMenu')}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
            <ChevronDown className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-2 top-10 z-50 w-64 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
            <div className="max-h-64 overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.href}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(localizedHref(tab.href, locale, clinicSlug));
                  }}
                  className="w-full truncate rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="my-1 border-t border-border" />
            <button
              type="button"
              onClick={refreshCurrentTab}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <RefreshCw className="size-4" />
              {translate('Navigation.refreshTab')}
            </button>
            <button
              type="button"
              onClick={closeAllTabs}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              <X className="size-4" />
              {translate('Navigation.closeAllTabs')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
