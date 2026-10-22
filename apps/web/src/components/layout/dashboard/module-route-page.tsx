'use client';

import { useTranslations } from 'next-intl';

import { ModuleTable } from '@/components/module-table/module-table';
import ModuleWorkspace from '@/components/workspace/module-workspace';
import { ChatWorkspace } from '../../../../app/[locale]/[organization-slug]/[clinic-slug]/(dashboard)/inbox/_components/chat-workspace';
import { NotificationCenter } from '@/features/platform/notification/components/notification-center';
import { navGroups } from '@/constants/navigation/sidebar-nav';
import AppointmentsPage from '@/features/clinical/appointment/components/appointments-page';
import PlatformAdministrationPage from '../../../../app/[locale]/[organization-slug]/[clinic-slug]/(dashboard)/platform-administration/page';
import { AccountingWorkspace } from '@/features/finance/accounting/components/accounting-workspace';
import { AccountingPeriodsWorkspace } from '@/features/finance/accounting/components/accounting-periods-workspace';
import { ChartOfAccountsWorkspace } from '@/features/finance/accounting/components/chart-of-accounts-workspace';
import { TaxParametersWorkspace } from '@/features/finance/accounting/components/tax-parameters-workspace';
import { AccountingPostingWorkspace } from '@/features/finance/accounting/components/accounting-posting-workspace';
import { FinancialEventsWorkspace } from '@/features/finance/accounting/components/financial-events-workspace';
import { FinanceLedgerWorkspace } from '@/features/finance/finance-ledger/components/finance-ledger-workspace';
import { CashRegisterWorkspace } from '@/features/finance/cash-register/components/cash-register-workspace';
import { BankWorkspace } from '@/features/finance/bank/components';
import { PartiesWorkspace } from '@/features/finance/party/components/parties-workspace';
import { PayrollWorkspace } from '@/features/finance/payroll/components/payroll-workspace';
import { PhysicalPosWorkspace } from '@/features/finance/pos/components/physical-pos-workspace';
import { VirtualPosWorkspace } from '@/features/finance/pos/components/virtual-pos-workspace';
import { InvoicesWorkspace } from '@/features/finance/invoice/components/invoices-workspace';
import { MetaAdsWorkspace } from '@/features/crm/meta-ads/components/meta-ads-workspace';

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
  if (moduleKey === 'crm/meta-ads') return <MetaAdsWorkspace />;
  if (moduleKey.startsWith('crm/health-tourism')) {
    return <ModuleTable module="marketing" />;
  }
  if (moduleKey === 'messaging/conversation') return <ChatWorkspace />;
  if (moduleKey === 'finance/accounting') return <AccountingWorkspace />;
  if (moduleKey === 'finance/accounting/periods')
    return <AccountingPeriodsWorkspace />;
  if (moduleKey === 'finance/accounting/chart-of-accounts')
    return <ChartOfAccountsWorkspace />;
  if (moduleKey === 'finance/accounting/tax-parameters')
    return <TaxParametersWorkspace />;
  if (moduleKey === 'finance/accounting/posting')
    return <AccountingPostingWorkspace />;
  if (moduleKey === 'finance/accounting/financial-events')
    return <FinancialEventsWorkspace />;
  if (moduleKey === 'finance/finance-ledger') return <FinanceLedgerWorkspace />;
  if (moduleKey === 'finance/cash-register') return <CashRegisterWorkspace />;
  if (moduleKey === 'finance/bank') return <BankWorkspace />;
  if (moduleKey === 'finance/party') return <PartiesWorkspace />;
  if (moduleKey === 'finance/payroll') return <PayrollWorkspace />;
  if (moduleKey === 'finance/invoice') return <InvoicesWorkspace />;
  if (moduleKey === 'finance/pos/physical') return <PhysicalPosWorkspace />;
  if (
    moduleKey === 'finance/pos/virtual' ||
    moduleKey === 'finance/payment-gateway'
  )
    return <VirtualPosWorkspace />;
  if (moduleKey.startsWith('finance/')) return <ModuleTable module="finance" />;
  if (moduleKey.startsWith('hr/'))
    return <ModuleWorkspace module="workforce" />;
  if (moduleKey === 'platform/notification') return <NotificationCenter />;
  if (moduleKey === 'platform/admin-request')
    return <PlatformAdministrationPage />;
  if (moduleKey.startsWith('supply/'))
    return <ModuleTable module="inventory" />;

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
