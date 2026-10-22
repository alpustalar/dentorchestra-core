'use client';

import * as React from 'react';
import {
  useParams,
  usePathname,
  useRouter,
  useSelectedLayoutSegments,
} from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, RefreshCw, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { navGroups } from '@/constants/navigation/sidebar-nav';
import { clinics } from '@/features/organization/clinic/data/mock-clinic';
import { organizations } from '@/features/organization/organization/data/mock-organization';
import { cn } from '@/lib/utils';

type PageTab = {
  href: string;
  label: string;
};

const STORAGE_KEY = 'dashboard-page-tabs';
const SUPPORTED_LOCALES = new Set(['tr', 'en']);
const ORGANIZATION_SLUGS = new Set(
  organizations.map((organization) => organization.slug)
);
const CLINIC_SLUGS = new Set(clinics.map((clinic) => clinic.slug));

function getTabLabel(pathname: string, translate: (key: string) => string) {
  const normalizedHref = normalizeHref(pathname);
  const href = normalizedHref;
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
    .find(
      ({ href: routeHref }) =>
        href === routeHref || href.startsWith(`${routeHref}/`)
    );

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

    return tabs
      .filter(
        (tab): tab is PageTab =>
          typeof tab === 'object' &&
          tab !== null &&
          'href' in tab &&
          typeof tab.href === 'string' &&
          'label' in tab &&
          typeof tab.label === 'string'
      )
      .map((tab) => ({ ...tab, href: normalizeHref(tab.href) }));
  } catch {
    return [];
  }
}

function normalizeHref(href: string) {
  const segments = href.split('/').filter(Boolean);
  if (segments.length > 0 && SUPPORTED_LOCALES.has(segments[0])) {
    segments.shift();
  }
  if (segments.length > 0 && ORGANIZATION_SLUGS.has(segments[0])) {
    segments.shift();
  }
  if (segments.length > 0 && CLINIC_SLUGS.has(segments[0])) {
    segments.shift();
  }
  return `/${segments.join('/')}` || '/';
}

function getSelectedPageHref(segments: string[]) {
  const pageSegments = segments.filter(
    (segment) => !(segment.startsWith('(') && segment.endsWith(')'))
  );

  return normalizeHref(`/${pageSegments.join('/')}`);
}

function localizedHref(
  href: string,
  locale: string,
  organizationSlug: string,
  clinicSlug: string
) {
  const clinicPath = `/${locale}/${organizationSlug}/${clinicSlug}`;
  if (href === '/') return clinicPath;

  const path = href.startsWith('/') ? href : `/${href}`;
  return `${clinicPath}${path}`;
}

export function PageTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const params = useParams<{
    'organization-slug': string;
    'clinic-slug': string;
  }>();
  const organizationSlug = params['organization-slug'] ?? 'as-yazilim';
  const clinicSlug = params['clinic-slug'] ?? 'fethiye';
  const translate = useTranslations();
  const queryClient = useQueryClient();

  // Next.js segment hook'u (URL kırılımlarını dizi olarak verir)
  const segments = useSelectedLayoutSegments();
  const pageHref = getSelectedPageHref(segments);

  const [tabs, setTabs] = React.useState<PageTab[]>([]);
  const [initialized, setInitialized] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [refreshingHref, setRefreshingHref] = React.useState<string | null>(
    null
  );
  const [refreshedHref, setRefreshedHref] = React.useState<string | null>(null);
  const [closeShortcut, setCloseShortcut] = React.useState('Alt W');
  const skipNextPathRef = React.useRef(false);
  const pendingRefreshRef = React.useRef<string | null>(null);
  const refreshTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const refreshedTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    setTabs(readStoredTabs());
    setCloseShortcut(
      /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌥ W' : 'Alt W'
    );
    setInitialized(true);
  }, []);

  React.useEffect(
    () => () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (refreshedTimerRef.current) clearTimeout(refreshedTimerRef.current);
    },
    []
  );

  React.useEffect(() => {
    if (!initialized) return;

    const href = pageHref;
    const routeHref = normalizeHref(pathname);
    if (skipNextPathRef.current) {
      skipNextPathRef.current = false;
      return;
    }

    setTabs((currentTabs) => {
      const pageTabs =
        routeHref === href
          ? currentTabs
          : currentTabs.filter((tab) => tab.href !== routeHref);
      const existingTab = pageTabs.find((tab) => tab.href === href);
      const translatedTabs = pageTabs.map((tab) => ({
        ...tab,
        label: getTabLabel(tab.href, translate),
      }));
      const nextTabs = existingTab
        ? translatedTabs
        : [...translatedTabs, { href, label: getTabLabel(href, translate) }];

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextTabs));
      return nextTabs;
    });
  }, [initialized, pageHref, pathname, translate]);

  const closeTab = React.useCallback(
    (href: string) => {
      const index = tabs.findIndex((tab) => tab.href === href);
      const nextTabs = tabs.filter((tab) => tab.href !== href);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextTabs));
      setTabs(nextTabs);

      if (pageHref === href) {
        const nextTab = nextTabs[Math.max(0, index - 1)] ?? nextTabs[0];
        if (nextTab) {
          router.push(
            localizedHref(nextTab.href, locale, organizationSlug, clinicSlug)
          );
        } else {
          router.push(localizedHref('/', locale, organizationSlug, clinicSlug));
        }
      }
    },
    [clinicSlug, locale, organizationSlug, pageHref, router, tabs]
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (
        event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.repeat &&
        event.code === 'KeyW' &&
        !isEditing
      ) {
        event.preventDefault();
        const activeHref = pageHref;
        if (tabs.some((tab) => tab.href === activeHref)) closeTab(activeHref);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeTab, pageHref, tabs]);

  const closeAllTabs = () => {
    skipNextPathRef.current = true;
    sessionStorage.removeItem(STORAGE_KEY);
    setTabs([]);
    setMenuOpen(false);
    router.push(localizedHref('/', locale, organizationSlug, clinicSlug));
  };

  const finishRefreshAnimation = React.useCallback((href: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (refreshedTimerRef.current) clearTimeout(refreshedTimerRef.current);

    refreshTimerRef.current = setTimeout(() => {
      setRefreshingHref(null);
      setRefreshedHref(href);
      refreshedTimerRef.current = setTimeout(() => {
        setRefreshedHref(null);
      }, 1000);
    }, 600);
  }, []);

  const refreshTab = React.useCallback(
    async (href: string) => {
      setMenuOpen(false);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (refreshedTimerRef.current) clearTimeout(refreshedTimerRef.current);
      setRefreshedHref(null);
      setRefreshingHref(href);
      const isActive = pageHref === href;
      await queryClient.invalidateQueries({
        refetchType: isActive ? 'active' : 'none',
      });

      if (isActive) {
        router.refresh();
        finishRefreshAnimation(href);
        return;
      }

      pendingRefreshRef.current = href;
      router.push(localizedHref(href, locale, organizationSlug, clinicSlug));
    },
    [
      clinicSlug,
      finishRefreshAnimation,
      locale,
      organizationSlug,
      pageHref,
      queryClient,
      router,
    ]
  );

  React.useEffect(() => {
    const href = pageHref;
    if (pendingRefreshRef.current !== href) return;

    pendingRefreshRef.current = null;
    router.refresh();
    finishRefreshAnimation(href);
  }, [finishRefreshAnimation, pageHref, router]);

  const refreshCurrentTab = () => {
    setMenuOpen(false);
    void refreshTab(pageHref);
  };

  if (!initialized || tabs.length === 0) return null;

  const activeHref = pageHref;
  const activeTabLabel =
    tabs.find((tab) => tab.href === activeHref)?.label ??
    getTabLabel(activeHref, translate);

  return (
    <nav
      aria-label={translate('Navigation.openPages')}
      className="relative flex h-11 shrink-0 items-end border-b border-border bg-background"
    >
      <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto px-3 md:px-5">
        {tabs.map((tab) => {
          const isActive = tab.href === activeHref;

          return (
            <div
              key={tab.href}
              className={cn(
                'group relative flex h-9 max-w-56 min-w-32 items-center rounded-t-md border border-b-0 pl-3 pr-14 text-sm transition-colors',
                isActive
                  ? 'border-border bg-muted/40 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <button
                type="button"
                onClick={() =>
                  router.push(
                    localizedHref(
                      tab.href,
                      locale,
                      organizationSlug,
                      clinicSlug
                    )
                  )
                }
                className="min-w-0 flex-1 truncate text-left"
                aria-current={isActive ? 'page' : undefined}
                title={tab.label}
              >
                {tab.label}
              </button>
              <button
                type="button"
                onClick={() => void refreshTab(tab.href)}
                aria-label={`${translate('Navigation.refreshTab')}: ${tab.label}`}
                className="absolute right-6 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {refreshedHref === tab.href ? (
                  <Check className="size-3.5 text-green-600" />
                ) : (
                  <RefreshCw
                    className={cn(
                      'size-3.5',
                      refreshingHref === tab.href && 'animate-spin'
                    )}
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => closeTab(tab.href)}
                aria-label={translate('Navigation.closePage', {
                  page: tab.label,
                })}
                className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3" />
              </button>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="relative flex h-full shrink-0 items-center bg-background px-2">
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
                    router.push(
                      localizedHref(
                        tab.href,
                        locale,
                        organizationSlug,
                        clinicSlug
                      )
                    );
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
              onClick={() => {
                setMenuOpen(false);
                closeTab(activeHref);
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <X className="size-4" />
              <span className="flex-1">
                {translate('Navigation.closePage', { page: activeTabLabel })}
              </span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {closeShortcut}
              </kbd>
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
