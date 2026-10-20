'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Activity, ChevronDown, ChevronLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  navGroups,
  type RoleSlug,
} from '@/constants/navigation/sidebar-nav';
import { useAuth } from '@/data/auth/auth-context';
import { useCurrentUser } from '@/data/auth/use-current-user';

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

const roleTranslationKeys: Record<RoleSlug, string> = {
  admin: 'Common.roles.admin',
  organization_owner: 'Common.roles.organizationOwner',
  branch_manager: 'Common.roles.branchManager',
  clinic_owner: 'Common.roles.clinicOwner',
  provider: 'Common.roles.provider',
  assistant: 'Common.roles.assistant',
  accountant: 'Common.roles.accountant',
  receptionist: 'Common.roles.receptionist',
  inventory_manager: 'Common.roles.inventoryManager',
  staff: 'Common.roles.staff',
};

function SidebarProvider({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnSidebarProvider defaultOpen={true}>{children}</ShadcnSidebarProvider>
  );
}

function SidebarMain() {
  const t = useTranslations();
  const { claims } = useAuth();
  const { displayName, initials } = useCurrentUser();

  const { state, toggleSidebar, isHovered } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ locale: string; 'clinic-slug': string }>();
  const isCollapsed = state === 'collapsed' && !isHovered;
  const isHoverExpanded = state === 'collapsed' && isHovered;
  const locale = params.locale ?? 'en';
  const clinicSlug = params['clinic-slug'] ?? 'fethiye';
  const [openMenus, setOpenMenus] = React.useState<Record<string, boolean>>({});

  const toggleMenu = (key: string) => {
    if (isCollapsed) return;
    setOpenMenus((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const isRouteActive = (href: string) => {
    if (!href) return pathname === `/${locale}/${clinicSlug}`;
    const target = `/${locale}/${clinicSlug}/${href}`;
    return pathname === target || pathname.startsWith(`${target}/`);
  };

  return (
    <Sidebar collapsible="icon" className="z-40">
      <button
        type="button"
        data-sidebar-hover-ignore
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-8 z-50 hidden h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:flex',
          isHoverExpanded && 'lg:hidden'
        )}
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
          const managementRoles: RoleSlug[] = [
            'admin',
            'organization_owner',
            'clinic_owner',
          ];
          const isManagementRole = managementRoles.includes(
            claims.role.slug as RoleSlug
          );
          const visibleItems = group.items.filter(
            (item) =>
              !item.roles ||
              item.roles.some((role) =>
                isManagementRole
                  ? managementRoles.includes(role)
                  : role === claims.role.slug
              )
          );

          if (visibleItems.length === 0) return null;

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
                  {visibleItems.map((item) => {
                    const itemLabel = t(item.translationKey);
                    const itemModule = item.href;
                    const isActive = isRouteActive(itemModule);
                    const hasChildren = !isCollapsed && Boolean(item.children?.length);
                    const isOpen =
                      Boolean(openMenus[item.translationKey]) ||
                      Boolean(item.children?.some((child) => isRouteActive(child.href)));

                    return (
                      <SidebarMenuItem key={item.translationKey}>
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={itemLabel}
                          onClick={() => {
                            router.push(
                              itemModule
                                ? `/${locale}/${clinicSlug}/${itemModule}`
                                : `/${locale}/${clinicSlug}`
                            );
                            if (hasChildren) toggleMenu(item.translationKey);
                          }}
                          className="cursor-pointer"
                        >
                          <item.icon className="h-[1.15rem] w-[1.15rem] shrink-0" />

                          <span className="flex-1 truncate">{itemLabel}</span>

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
                          <SidebarMenuSub className="my-1 ml-4 space-y-1 border-l border-sidebar-border/60 pl-3">
                            {item.children?.map((child, index, children) => {
                              const childLabel = t(child.translationKey);
                              const isChildActive = isRouteActive(child.href);
                              const isLastChild = index === children.length - 1;

                              return (
                                <SidebarMenuSubItem
                                  key={child.translationKey}
                                  className="relative"
                                >
                                  <span className="absolute -left-3 top-1/2 h-px w-2.5 -translate-y-1/2 bg-sidebar-border/60" />
                                  {isLastChild && (
                                    <span className="absolute -left-3 -top-2 h-1/2 w-px bg-sidebar-background" />
                                  )}
                                  <SidebarMenuSubButton
                                    isActive={isChildActive}
                                    onClick={() =>
                                      router.push(
                                        `/${locale}/${clinicSlug}/${child.href}`
                                      )
                                    }
                                    className="cursor-pointer"
                                  >
                                    <span className="flex-1 truncate">
                                      {childLabel}
                                    </span>
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
              name: displayName,
              role: t(
                roleTranslationKeys[claims.role.slug as RoleSlug] ??
                  'Common.roles.staff'
              ),
            })}
            className="justify-center p-2"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials}
            </div>
          </SidebarMenuButton>
        ) : (
          <div className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent/50">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initials}
            </div>

            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName || t('Common.userFallback')}
              </span>

              <span className="truncate text-xs text-muted-foreground">
                {t(
                  roleTranslationKeys[claims.role.slug as RoleSlug] ??
                    'Common.roles.staff'
                )}
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
