'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Check,
  KeyRound,
  Layers3,
  LockKeyhole,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AVAILABLE_ROLES } from '@/data/auth/auth-context';
import { cn } from '@/lib/utils';

type RoleSlug = (typeof AVAILABLE_ROLES)[number]['slug'];

const roleNameKeys: Record<RoleSlug, string> = {
  admin: 'roles.admin',
  organization_owner: 'roles.organizationOwner',
  branch_manager: 'roles.branchManager',
  clinic_owner: 'roles.clinicOwner',
  provider: 'roles.provider',
  assistant: 'roles.assistant',
  accountant: 'roles.accountant',
  receptionist: 'roles.receptionist',
  inventory_manager: 'roles.inventoryManager',
  staff: 'roles.staff',
};

const roleScopeKeys: Record<RoleSlug, string> = {
  admin: 'scopes.platform',
  organization_owner: 'scopes.organization',
  branch_manager: 'scopes.branches',
  clinic_owner: 'scopes.clinic',
  provider: 'scopes.clinic',
  assistant: 'scopes.clinic',
  accountant: 'scopes.clinic',
  receptionist: 'scopes.clinic',
  inventory_manager: 'scopes.clinic',
  staff: 'scopes.clinic',
};

type CapabilityGroup = {
  module: string;
  actions: string[];
};

function groupCapabilities(capabilities: string[]): CapabilityGroup[] {
  const groups = new Map<string, Set<string>>();

  capabilities.forEach((capability) => {
    const separatorIndex = capability.lastIndexOf(':');
    const module =
      separatorIndex === -1 ? capability : capability.slice(0, separatorIndex);
    const action =
      separatorIndex === -1 ? 'access' : capability.slice(separatorIndex + 1);
    const actions = groups.get(module) ?? new Set<string>();
    actions.add(action);
    groups.set(module, actions);
  });

  return Array.from(groups, ([module, actions]) => ({
    module,
    actions: Array.from(actions),
  }));
}

function normalizeSearch(value: string, locale: string) {
  return value.trim().toLocaleLowerCase(locale);
}

export function RolesWorkspace() {
  const t = useTranslations('IdentityRoles');
  const common = useTranslations('Common');
  const locale = useLocale();
  const [selectedRoleSlug, setSelectedRoleSlug] = useState<RoleSlug>(
    AVAILABLE_ROLES[0].slug
  );
  const [roleSearch, setRoleSearch] = useState('');
  const [capabilitySearch, setCapabilitySearch] = useState('');

  const selectedRole =
    AVAILABLE_ROLES.find((role) => role.slug === selectedRoleSlug) ??
    AVAILABLE_ROLES[0];
  const selectedGroups = useMemo(
    () => groupCapabilities(selectedRole.capabilities),
    [selectedRole]
  );
  const roleQuery = normalizeSearch(roleSearch, locale);
  const capabilityQuery = normalizeSearch(capabilitySearch, locale);
  const filteredRoles = AVAILABLE_ROLES.filter((role) => {
    const roleName = common(roleNameKeys[role.slug]);
    return [roleName, role.slug].some((value) =>
      normalizeSearch(value, locale).includes(roleQuery)
    );
  });
  const filteredGroups = selectedGroups.filter((group) =>
    [group.module, ...group.actions].some((value) =>
      normalizeSearch(value, locale).includes(capabilityQuery)
    )
  );
  const allCapabilities = new Set(
    AVAILABLE_ROLES.flatMap((role) => role.capabilities)
  );
  const allModules = new Set(
    Array.from(allCapabilities, (capability) => capability.split(':')[0])
  );

  return (
    <section className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <ShieldCheck className="size-4" />
            {t('eyebrow')}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Badge variant="outline" className="h-7 px-3">
          <LockKeyhole />
          {t('readOnly')}
        </Badge>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={UsersRound}
          label={t('summary.roles')}
          value={AVAILABLE_ROLES.length}
        />
        <SummaryCard
          icon={Layers3}
          label={t('summary.modules')}
          value={allModules.size}
        />
        <SummaryCard
          icon={KeyRound}
          label={t('summary.capabilities')}
          value={allCapabilities.size}
        />
      </div>

      <div className="grid min-h-[620px] gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start lg:sticky lg:top-30">
          <CardHeader className="border-b">
            <CardTitle>{t('roleList.title')}</CardTitle>
            <CardDescription>{t('roleList.description')}</CardDescription>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={roleSearch}
                onChange={(event) => setRoleSearch(event.target.value)}
                placeholder={t('roleList.searchPlaceholder')}
                aria-label={t('roleList.searchLabel')}
                className="h-10 pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredRoles.map((role) => {
              const isSelected = role.slug === selectedRole.slug;

              return (
                <button
                  key={role.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedRoleSlug(role.slug);
                    setCapabilitySearch('');
                  }}
                  className={cn(
                    'flex min-h-16 w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                    isSelected
                      ? 'border-primary/30 bg-primary/8 text-foreground'
                      : 'border-transparent hover:border-border hover:bg-muted/60'
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <ShieldCheck className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {common(roleNameKeys[role.slug])}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[11px] text-muted-foreground">
                      {role.slug}
                    </span>
                  </span>
                  <Badge variant="secondary">{role.priority}</Badge>
                </button>
              );
            })}
            {filteredRoles.length === 0 && (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {t('roleList.empty')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-xl">
                    {common(roleNameKeys[selectedRole.slug])}
                  </CardTitle>
                  {selectedRole.isSystemRole && (
                    <Badge variant="secondary">{t('systemRole')}</Badge>
                  )}
                  <Badge variant="outline">
                    {t(roleScopeKeys[selectedRole.slug])}
                  </Badge>
                </div>
                <CardDescription className="mt-2 max-w-3xl">
                  {t(`descriptions.${selectedRole.slug}`)}
                </CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2.5 py-1 font-mono">
                    {selectedRole.slug}
                  </span>
                  <span className="rounded-md bg-muted px-2.5 py-1">
                    {t('priority', { value: selectedRole.priority })}
                  </span>
                  <span className="rounded-md bg-muted px-2.5 py-1">
                    {t('moduleCount', { count: selectedGroups.length })}
                  </span>
                  <span className="rounded-md bg-muted px-2.5 py-1">
                    {t('capabilityCount', {
                      count: selectedRole.capabilities.length,
                    })}
                  </span>
                </div>
              </div>
              <div className="relative w-full xl:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={capabilitySearch}
                  onChange={(event) => setCapabilitySearch(event.target.value)}
                  placeholder={t('capabilities.searchPlaceholder')}
                  aria-label={t('capabilities.searchLabel')}
                  className="h-10 pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t('capabilities.title')}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('capabilities.description')}
                </p>
              </div>
              <Badge variant="outline">
                {t('capabilities.resultCount', {
                  count: filteredGroups.length,
                })}
              </Badge>
            </div>

            {filteredGroups.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {filteredGroups.map((group) => (
                  <article
                    key={group.module}
                    className="rounded-lg border bg-muted/15 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{group.module}</p>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                          {t('capabilities.moduleCode')}
                        </p>
                      </div>
                      <Badge variant="secondary">{group.actions.length}</Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.actions.map((action) => (
                        <span
                          key={action}
                          className="inline-flex min-h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs"
                        >
                          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                          {t.has(`actions.${action}`)
                            ? t(`actions.${action}`)
                            : action}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-10 text-center">
                <KeyRound className="mx-auto size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">
                  {t('capabilities.emptyTitle')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('capabilities.emptyDescription')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
