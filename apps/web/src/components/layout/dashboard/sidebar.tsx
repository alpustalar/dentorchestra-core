'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Activity, ChevronDown, ChevronLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { navGroups } from '@/constants/navigation/sidebar-nav';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider as ShadcnSidebarProvider,
  useSidebar,
} from '@/components/ui/sidebar';
import { APP } from '@/constants';

const user = {
  name: 'Zeynep Ak',
  role: 'Klinik Yöneticisi',
};

function SidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnSidebarProvider defaultOpen={true}>{children}</ShadcnSidebarProvider>
  );
}

function SidebarMain() {
  const t = useTranslations();

  const { state, toggleSidebar } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const isCollapsed = state === 'collapsed';
  const locale = params.locale ?? 'en';

  const routeSlugs: Record<string, string> = {
    'Navigation.items.overview': '',
    'Navigation.items.patients': 'patients',
    'Navigation.items.appointments': 'appointments',
    'Navigation.items.medicalFiles': 'medical-files',
    'Navigation.items.consentForms': 'consent-forms',
    'Navigation.items.treatmentsAndPackages': 'treatments',
    'Navigation.items.specialists': 'specialists',
    'Navigation.items.omnichannelMessaging': 'inbox',
    'Navigation.items.leadAndMetaAds': 'leads',
    'Navigation.items.salesPipeline': 'sales-pipeline',
    'Navigation.items.crmActivities': 'crm-activities',
    'Navigation.items.healthTourism': 'health-tourism',
    'Navigation.items.generalLedger': 'general-ledger',
    'Navigation.items.invoicesAndFees': 'invoices',
    'Navigation.items.paymentsAndPos': 'payments',
    'Navigation.items.cashAndBank': 'cash-bank',
    'Navigation.items.payroll': 'payroll',
    'Navigation.items.stockAndInventory': 'inventory',
    'Navigation.items.procurement': 'procurement',
    'Navigation.items.workOrders': 'work-orders',
    'Navigation.items.staffList': 'staff',
    'Navigation.items.timeAndAttendance': 'attendance',
    'Navigation.items.leaveManagement': 'leave-management',
  };

  const slugifyRoute = (translationKey: string) =>
    routeSlugs[translationKey] ??
    translationKey
      .split('.')
      .at(-1)
      ?.replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase() ??
    'workspace';

  const activeModule = pathname.split('/').filter(Boolean).at(-1) ?? '';

  const [openMenus, setOpenMenus] = React.useState<Record<string, boolean>>({});

  const toggleMenu = (key: string) => {
    if (isCollapsed) return;

    setOpenMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Sidebar collapsible="icon" className="z-40">
      <button
        type="button"
        onClick={toggleSidebar}
        className="absolute -right-3 top-8 z-50 hidden h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex"
        title={
          isCollapsed ? t('Common.toggleExpand') : t('Common.toggleCollapse')
        }
        aria-label={
          isCollapsed ? t('Common.toggleExpand') : t('Common.toggleCollapse')
        }
      >
        <ChevronLeft
          className={cn(
            'h-3 w-3 transition-transform duration-300',
            isCollapsed && 'rotate-180'
          )}
        />
      </button>

      {/* Header */}
      <SidebarHeader
        className={cn(
          'h-16 justify-center border-b border-sidebar-border',
          isCollapsed ? 'px-2' : 'px-4'
        )}
      >
        <div
          className={cn(
            'flex items-center transition-all',
            isCollapsed ? 'justify-center px-0' : 'gap-2.5'
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>

          {!isCollapsed && (
            <div className="flex min-w-0 flex-col leading-none">
              <span className="truncate text-sm font-semibold text-sidebar-foreground">
                {APP.NAME}
              </span>

              <span className="truncate text-xs text-muted-foreground">
                {t('Common.appSubtitle')}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className={cn('py-5', isCollapsed ? 'px-1' : 'px-2')}>
        {navGroups.map((group) => {
          const groupTitle = t(group.groupKey);

          return (
            <SidebarGroup key={group.groupKey} className="mb-4 p-0">
              {!isCollapsed && (
                <SidebarGroupLabel className="mb-1 px-2 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                  {groupTitle}
                </SidebarGroupLabel>
              )}

              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const itemLabel = t(item.translationKey);
                    const itemModule = slugifyRoute(item.translationKey);
                    const isActive =
                      item.translationKey === 'Navigation.items.overview'
                        ? pathname === `/${locale}` ||
                          pathname === `/${locale}/`
                        : pathname.split('/').includes(itemModule);

                    const hasChildren =
                      !isCollapsed && Boolean(item.children?.length);

                    const isOpen = Boolean(openMenus[item.translationKey]);

                    return (
                      <SidebarMenuItem key={item.translationKey}>
                        <SidebarMenuButton
                          isActive={isActive && (!hasChildren || isCollapsed)}
                          tooltip={itemLabel}
                          onClick={() => {
                            router.push(
                              itemModule
                                ? `/${locale}/${itemModule}`
                                : `/${locale}`
                            );
                            if (hasChildren) {
                              toggleMenu(item.translationKey);
                            }
                          }}
                          className="cursor-pointer"
                        >
                          <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" />

                          <span className="flex-1 truncate">{itemLabel}</span>

                          {item.badge && !isCollapsed && (
                            <span
                              className={cn(
                                'ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold',
                                item.badge === '!'
                                  ? 'bg-destructive/15 text-destructive'
                                  : isActive
                                    ? 'bg-primary/15 text-primary'
                                    : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {item.badge}
                            </span>
                          )}

                          {hasChildren && (
                            <ChevronDown
                              className={cn(
                                'ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                                isOpen && 'rotate-180'
                              )}
                            />
                          )}
                        </SidebarMenuButton>

                        {!isCollapsed && hasChildren && isOpen && (
                          <SidebarMenuSub className="relative my-1 ml-4 space-y-1 border-l border-sidebar-border/60 pl-3">
                            {item.children?.map((child, index, arr) => {
                              const childLabel = t(child.translationKey);
                              const childModule = slugifyRoute(
                                child.translationKey
                              );
                              const isChildActive = pathname
                                .split('/')
                                .includes(childModule);
                              const isLast = index === arr.length - 1;

                              return (
                                <SidebarMenuSubItem
                                  key={child.translationKey}
                                  className="relative"
                                >
                                  {/* Horizontal connector */}
                                  <div className="absolute -left-3 top-1/2 h-px w-2.5 -translate-y-1/2 bg-sidebar-border/60" />

                                  {/* Last item connector */}
                                  {isLast && (
                                    <div className="absolute -left-3 -top-2 h-1/2 w-px bg-sidebar-background" />
                                  )}

                                  <SidebarMenuSubButton
                                    isActive={isChildActive}
                                    onClick={() => {
                                      router.push(`/${locale}/${childModule}`);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <span className="flex-1 truncate">
                                      {childLabel}
                                    </span>

                                    {isChildActive && (
                                      <span className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                    )}
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter
        className={cn(
          'border-t border-sidebar-border',
          isCollapsed ? 'p-2' : 'p-3'
        )}
      >
        {isCollapsed ? (
          <SidebarMenuButton
            tooltip={t('Common.userProfile', {
              name: 'Zeynep Ak',
              role: t('Common.clinicManager'),
            })}
            className="justify-center p-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              ZA
            </div>
          </SidebarMenuButton>
        ) : (
          <div className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>

            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name}
              </span>

              <span className="truncate text-xs text-muted-foreground">
                {user.role}
              </span>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export const NavigationSidebar = {
  Provider: SidebarProvider,
  Content: SidebarMain,
};
