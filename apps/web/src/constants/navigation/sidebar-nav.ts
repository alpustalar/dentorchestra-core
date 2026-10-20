import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CreditCard,
  FileText,
  HeartPulse,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  PackageSearch,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
  Bell,
  type LucideIcon,
} from 'lucide-react';

export const ROLE_SLUGS = {
  ADMIN: 'admin',
  ORGANIZATION_OWNER: 'organization_owner',
  BRANCH_MANAGER: 'branch_manager',
  CLINIC_OWNER: 'clinic_owner',
  PROVIDER: 'provider',
  ASSISTANT: 'assistant',
  ACCOUNTANT: 'accountant',
  RECEPTIONIST: 'receptionist',
  INVENTORY_MANAGER: 'inventory_manager',
  STAFF: 'staff',
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

export interface NavChild {
  translationKey: string;
  href: string;
}

export interface NavItem {
  icon: LucideIcon;
  translationKey: string;
  href: string;
  roles?: RoleSlug[];
  children?: NavChild[];
}

export interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

const clinicRoles: RoleSlug[] = [
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.ORGANIZATION_OWNER,
  ROLE_SLUGS.CLINIC_OWNER,
  ROLE_SLUGS.BRANCH_MANAGER,
  ROLE_SLUGS.PROVIDER,
  ROLE_SLUGS.ASSISTANT,
  ROLE_SLUGS.RECEPTIONIST,
];
const managers: RoleSlug[] = [
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.ORGANIZATION_OWNER,
  ROLE_SLUGS.CLINIC_OWNER,
];
const financeRoles = [...managers, ROLE_SLUGS.ACCOUNTANT];
const salesRoles = [...managers, ROLE_SLUGS.BRANCH_MANAGER];

export const navGroups: NavGroup[] = [
  {
    groupKey: 'Navigation.groups.general',
    items: [
      {
        icon: LayoutDashboard,
        translationKey: 'Navigation.items.overview',
        href: '',
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.clinical',
    items: [
      { icon: CalendarDays, translationKey: 'Navigation.items.appointments', href: 'clinical/appointment', roles: clinicRoles },
      { icon: FileText, translationKey: 'Navigation.items.medicalFiles', href: 'clinical/medical-files', roles: clinicRoles },
      { icon: FileText, translationKey: 'Navigation.items.consentForms', href: 'clinical/consent-form', roles: clinicRoles },
      { icon: Stethoscope, translationKey: 'Navigation.items.providers', href: 'clinical/provider', roles: clinicRoles },
      { icon: HeartPulse, translationKey: 'Navigation.items.treatments', href: 'clinical/treatment', roles: clinicRoles },
      { icon: HeartPulse, translationKey: 'Navigation.items.treatmentPackages', href: 'clinical/treatment-package', roles: clinicRoles },
    ],
  },
  {
    groupKey: 'Navigation.groups.crm',
    items: [
      { icon: Users, translationKey: 'Navigation.items.patients', href: 'crm/patient', roles: clinicRoles },
      { icon: Users, translationKey: 'Navigation.items.leads', href: 'crm/lead', roles: salesRoles },
      { icon: Activity, translationKey: 'Navigation.items.pipeline', href: 'crm/pipeline', roles: salesRoles },
      { icon: Activity, translationKey: 'Navigation.items.activities', href: 'crm/activity', roles: salesRoles },
      { icon: Megaphone, translationKey: 'Navigation.items.metaAds', href: 'crm/meta-ads', roles: salesRoles },
      {
        icon: Building2,
        translationKey: 'Navigation.items.healthTourism',
        href: 'crm/health-tourism',
        roles: salesRoles,
        children: [
          { translationKey: 'Navigation.items.tourismConfiguration', href: 'crm/health-tourism/config' },
          { translationKey: 'Navigation.items.tourismBookings', href: 'crm/health-tourism/booking-payment' },
          { translationKey: 'Navigation.items.tourismFlights', href: 'crm/health-tourism/flight' },
          { translationKey: 'Navigation.items.tourismHotels', href: 'crm/health-tourism/hotel' },
          { translationKey: 'Navigation.items.tourismTransfers', href: 'crm/health-tourism/transfer' },
        ],
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.messaging',
    items: [
      { icon: MessagesSquare, translationKey: 'Navigation.items.conversations', href: 'messaging/conversation', roles: clinicRoles },
      { icon: Settings, translationKey: 'Navigation.items.channels', href: 'messaging/channel-config', roles: managers },
      { icon: Settings, translationKey: 'Navigation.items.aiAgent', href: 'messaging/ai-agent', roles: managers },
    ],
  },
  {
    groupKey: 'Navigation.groups.finance',
    items: [
      {
        icon: Wallet,
        translationKey: 'Navigation.items.accounting',
        href: 'finance/accounting',
        roles: financeRoles,
        children: [
          { translationKey: 'Navigation.items.chartOfAccounts', href: 'finance/accounting/chart-of-accounts' },
          { translationKey: 'Navigation.items.financialEvents', href: 'finance/accounting/financial-events' },
          { translationKey: 'Navigation.items.accountingPeriods', href: 'finance/accounting/periods' },
          { translationKey: 'Navigation.items.posting', href: 'finance/accounting/posting' },
          { translationKey: 'Navigation.items.taxParameters', href: 'finance/accounting/tax-parameters' },
        ],
      },
      { icon: Wallet, translationKey: 'Navigation.items.financeLedger', href: 'finance/finance-ledger', roles: financeRoles },
      { icon: FileText, translationKey: 'Navigation.items.invoices', href: 'finance/invoice', roles: financeRoles },
      { icon: FileText, translationKey: 'Navigation.items.purchaseInvoices', href: 'finance/purchase-invoice', roles: financeRoles },
      { icon: FileText, translationKey: 'Navigation.items.eDocuments', href: 'finance/e-document', roles: financeRoles },
      { icon: CreditCard, translationKey: 'Navigation.items.payments', href: 'finance/payment', roles: financeRoles },
      { icon: CreditCard, translationKey: 'Navigation.items.paymentGateways', href: 'finance/payment-gateway', roles: managers },
      {
        icon: CreditCard,
        translationKey: 'Navigation.items.pos',
        href: 'finance/pos',
        roles: financeRoles,
        children: [
          { translationKey: 'Navigation.items.physicalPos', href: 'finance/pos/physical' },
          { translationKey: 'Navigation.items.virtualPos', href: 'finance/pos/virtual' },
        ],
      },
      { icon: Wallet, translationKey: 'Navigation.items.cashRegister', href: 'finance/cash-register', roles: financeRoles },
      { icon: Wallet, translationKey: 'Navigation.items.bank', href: 'finance/bank', roles: financeRoles },
      { icon: Users, translationKey: 'Navigation.items.party', href: 'finance/party', roles: financeRoles },
      { icon: HeartPulse, translationKey: 'Navigation.items.treatmentCharges', href: 'finance/treatment-charge', roles: financeRoles },
      { icon: BriefcaseBusiness, translationKey: 'Navigation.items.payroll', href: 'finance/payroll', roles: financeRoles },
    ],
  },
  {
    groupKey: 'Navigation.groups.humanResources',
    items: [
      { icon: BriefcaseBusiness, translationKey: 'Navigation.items.employees', href: 'hr/employee', roles: [...managers, ROLE_SLUGS.BRANCH_MANAGER] },
      { icon: CalendarDays, translationKey: 'Navigation.items.attendance', href: 'hr/attendance', roles: [...managers, ROLE_SLUGS.BRANCH_MANAGER] },
      { icon: CalendarDays, translationKey: 'Navigation.items.leave', href: 'hr/leave', roles: [...managers, ROLE_SLUGS.BRANCH_MANAGER] },
    ],
  },
  {
    groupKey: 'Navigation.groups.identity',
    items: [
      {
        icon: ShieldCheck,
        translationKey: 'Navigation.items.authentication',
        href: 'identity/auth',
        roles: managers,
        children: [
          { translationKey: 'Navigation.items.staffAuthentication', href: 'identity/auth/auth' },
          { translationKey: 'Navigation.items.patientAuthentication', href: 'identity/auth/patient-auth' },
          { translationKey: 'Navigation.items.registration', href: 'identity/auth/registration' },
        ],
      },
      { icon: ShieldCheck, translationKey: 'Navigation.items.roles', href: 'identity/role', roles: managers },
      { icon: Users, translationKey: 'Navigation.items.users', href: 'identity/user', roles: managers },
    ],
  },
  {
    groupKey: 'Navigation.groups.organization',
    items: [
      { icon: Building2, translationKey: 'Navigation.items.clinics', href: 'organization/clinic', roles: [...managers, ROLE_SLUGS.BRANCH_MANAGER] },
      { icon: ShieldCheck, translationKey: 'Navigation.items.clinicGovernance', href: 'organization/clinic-governance', roles: managers },
      { icon: Building2, translationKey: 'Navigation.items.organizations', href: 'organization/organization', roles: [ROLE_SLUGS.ADMIN, ROLE_SLUGS.ORGANIZATION_OWNER] },
      { icon: BriefcaseBusiness, translationKey: 'Navigation.items.projects', href: 'organization/project', roles: managers },
    ],
  },
  {
    groupKey: 'Navigation.groups.platform',
    items: [
      { icon: ShieldCheck, translationKey: 'Navigation.items.platformAdministration', href: 'platform/admin-request', roles: [ROLE_SLUGS.ADMIN] },
      { icon: Settings, translationKey: 'Navigation.items.aiTools', href: 'platform/ai-tools', roles: managers },
      { icon: Activity, translationKey: 'Navigation.items.auditLog', href: 'platform/audit-log', roles: [ROLE_SLUGS.ADMIN] },
      { icon: Bell, translationKey: 'Navigation.items.notifications', href: 'platform/notification' },
      {
        icon: ShieldCheck,
        translationKey: 'Navigation.items.policies',
        href: 'platform/policy',
        roles: managers,
        children: [
          { translationKey: 'Navigation.items.entityPolicies', href: 'platform/policy/entity' },
          { translationKey: 'Navigation.items.patientPolicies', href: 'platform/policy/patient' },
          { translationKey: 'Navigation.items.staffPolicies', href: 'platform/policy/staff' },
        ],
      },
      { icon: CreditCard, translationKey: 'Navigation.items.subscription', href: 'platform/subscription', roles: managers },
    ],
  },
  {
    groupKey: 'Navigation.groups.supply',
    items: [
      { icon: PackageSearch, translationKey: 'Navigation.items.inventory', href: 'supply/inventory', roles: [...managers, ROLE_SLUGS.BRANCH_MANAGER, ROLE_SLUGS.INVENTORY_MANAGER, ROLE_SLUGS.ASSISTANT] },
      { icon: PackageSearch, translationKey: 'Navigation.items.purchasing', href: 'supply/purchasing', roles: [...managers, ROLE_SLUGS.INVENTORY_MANAGER] },
      { icon: Settings, translationKey: 'Navigation.items.workOrders', href: 'supply/work-order', roles: [...managers, ROLE_SLUGS.INVENTORY_MANAGER, ROLE_SLUGS.PROVIDER] },
    ],
  },
];
