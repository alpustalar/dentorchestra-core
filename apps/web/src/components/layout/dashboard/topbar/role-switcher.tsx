'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { useAuth } from '@/data/auth/auth-context';

const roleTranslationKeys: Record<string, string> = {
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

const roleScopeTranslationKeys: Record<string, string> = {
  admin: 'Common.roleScopes.platform',
  organization_owner: 'Common.roleScopes.organization',
  branch_manager: 'Common.roleScopes.branches',
  clinic_owner: 'Common.roleScopes.clinic',
};

export function RoleSwitcher() {
  const t = useTranslations();
  const {
    claims,
    selectableRoles,
    setMockRole,
    canSwitchRole,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  if (!canSwitchRole) return null;

  const currentRoleLabel = t(
    roleTranslationKeys[claims.role.slug] ?? 'Common.roles.staff'
  );

  return (
    <div ref={containerRef} className="relative shrink-0">
      <div className="group absolute right-1 top-1 z-10">
        <button
          type="button"
          aria-label={t('Common.roleSwitcherInfo')}
          aria-describedby="role-switcher-info"
          className="flex size-6 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="size-4" />
        </button>
        <span
          id="role-switcher-info"
          role="tooltip"
          className="pointer-events-none invisible absolute right-0 top-7 z-50 w-64 rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground opacity-0 shadow-lg transition-opacity duration-75 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        >
          {t('Common.roleSwitcherInfo')}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('Common.changeRole')}
        className="flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 pr-9 text-left text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="hidden text-muted-foreground sm:inline">
          {t('Common.selectRole')}:
        </span>
        <span className="max-w-36 truncate font-medium">{currentRoleLabel}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t('Common.changeRole')}
          className="absolute left-0 top-11 z-50 min-w-60 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
            {t('Common.changeRole')}
          </div>
          {selectableRoles.map((role) => {
            const isSelected = role.slug === claims.role.slug;

            return (
              <button
                key={role.slug}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  setMockRole(role.slug);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {t(roleTranslationKeys[role.slug] ?? 'Common.roles.staff')}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {t(
                      roleScopeTranslationKeys[role.slug] ??
                        'Common.roleScopes.clinic'
                    )}
                  </span>
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
