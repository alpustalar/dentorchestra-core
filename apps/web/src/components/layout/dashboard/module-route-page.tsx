'use client';

import { useTranslations } from 'next-intl';

import { ModuleTable } from '@/components/module-table/module-table';
import ModuleWorkspace from '@/components/workspace/module-workspace';
import { ChatWorkspace } from '../../../../app/[locale]/[clinic-slug]/(dashboard)/inbox/_components/chat-workspace';
import { NotificationCenter } from '@/features/platform/notification/components/notification-center';
import { navGroups } from '@/constants/navigation/sidebar-nav';
import AppointmentsPage from '@/features/clinical/appointment/components/appointments-page';
import PlatformAdministrationPage from '../../../../app/[locale]/[clinic-slug]/(dashboard)/platform-administration/page';

export function ModuleRoutePage({ moduleKey }: { moduleKey: string }) {
  const t = useTranslations();

  if (moduleKey === 'clinical/appointment') return <AppointmentsPage />;
  if (moduleKey === 'crm/patient') return <ModuleTable module="patients" />;
  if (
    moduleKey === 'crm/lead' ||
    moduleKey === 'crm/pipeline' ||
    moduleKey === 'crm/activity'
  ) {
    return <ModuleTable module="crm" />;
  }
  if (moduleKey === 'crm/meta-ads' || moduleKey.startsWith('crm/health-tourism')) {
    return <ModuleTable module="marketing" />;
  }
  if (moduleKey === 'messaging/conversation') return <ChatWorkspace />;
  if (moduleKey.startsWith('finance/')) return <ModuleTable module="finance" />;
  if (moduleKey.startsWith('hr/')) return <ModuleWorkspace module="workforce" />;
  if (moduleKey === 'platform/notification') return <NotificationCenter />;
  if (moduleKey === 'platform/admin-request') return <PlatformAdministrationPage />;
  if (moduleKey.startsWith('supply/')) return <ModuleTable module="inventory" />;

  const items = navGroups.flatMap((group) => group.items);
  const item = items.find((navItem) => navItem.href === moduleKey);
  const child = items
    .flatMap((navItem) => navItem.children ?? [])
    .find((navChild) => navChild.href === moduleKey);
  const titleKey = item?.translationKey ?? child?.translationKey;
  const title = titleKey ? t(titleKey) : t('Navigation.moduleTitle');

  return (
    <section className="p-6 md:p-8">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {t('Navigation.moduleDescription')}
        </p>
      </div>
    </section>
  );
}
