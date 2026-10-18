import {
  Activity,
  Banknote,
  Boxes,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Contact2,
  CreditCard,
  FileText,
  FolderKanban,
  HeartPulse,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessagesSquare,
  Network,
  PackagePlus,
  Receipt,
  Settings,
  ShieldCheck,
  Stethoscope,
  Store,
  Users,
  Wallet,
  Wrench,
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
  roles?: RoleSlug[];
}

export interface NavItem {
  icon: LucideIcon;
  translationKey: string;
  badge?: string | null;
  roles?: RoleSlug[];
  children?: NavChild[];
}

export interface NavGroup {
  groupKey: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    groupKey: 'Navigation.groups.general',
    items: [
      {
        icon: LayoutDashboard,
        translationKey: 'Navigation.items.overview',
        badge: null,
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.clinicAndOperations',
    items: [
      {
        icon: Users,
        translationKey: 'Navigation.items.patients',
        badge: '1.284',
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
          ROLE_SLUGS.PROVIDER,
          ROLE_SLUGS.ASSISTANT,
          ROLE_SLUGS.RECEPTIONIST,
        ],
        children: [
          { translationKey: 'Navigation.items.activePatients', href: '#' },
          { translationKey: 'Navigation.items.newPatient', href: '#' },
          { translationKey: 'Navigation.items.archivedPatients', href: '#' },
        ],
      },
      {
        icon: CalendarDays,
        translationKey: 'Navigation.items.appointments',
        badge: '47',
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
          ROLE_SLUGS.PROVIDER,
          ROLE_SLUGS.ASSISTANT,
          ROLE_SLUGS.RECEPTIONIST,
        ],
      },
      {
        icon: FileText,
        translationKey: 'Navigation.items.medicalFiles',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.PROVIDER,
          ROLE_SLUGS.ASSISTANT,
        ],
      },
      {
        icon: ClipboardList,
        translationKey: 'Navigation.items.consentForms',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.PROVIDER,
          ROLE_SLUGS.ASSISTANT,
          ROLE_SLUGS.RECEPTIONIST,
        ],
      },
      {
        icon: HeartPulse,
        translationKey: 'Navigation.items.treatmentsAndPackages',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.PROVIDER,
          ROLE_SLUGS.ASSISTANT,
        ],
        children: [
          {
            translationKey: 'Navigation.items.treatmentDefinitions',
            href: '#',
          },
          { translationKey: 'Navigation.items.treatmentPackages', href: '#' },
        ],
      },
      {
        icon: Stethoscope,
        translationKey: 'Navigation.items.specialists',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
        ],
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.salesAndCrm',
    items: [
      {
        icon: MessagesSquare,
        translationKey: 'Navigation.items.omnichannelMessaging',
        badge: '4',
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
          ROLE_SLUGS.RECEPTIONIST,
          ROLE_SLUGS.ASSISTANT,
        ],
      },
      {
        icon: Network,
        translationKey: 'Navigation.items.leadAndMetaAds',
        badge: '329',
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
        ],
      },
      {
        icon: FolderKanban,
        translationKey: 'Navigation.items.salesPipeline',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
          ROLE_SLUGS.RECEPTIONIST,
        ],
      },
      {
        icon: Activity,
        translationKey: 'Navigation.items.crmActivities',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
          ROLE_SLUGS.RECEPTIONIST,
        ],
      },
      {
        icon: Megaphone,
        translationKey: 'Navigation.items.healthTourism',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
        ],
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.financeAndAccounting',
    items: [
      {
        icon: Wallet,
        translationKey: 'Navigation.items.generalLedger',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.ACCOUNTANT,
        ],
        children: [
          { translationKey: 'Navigation.items.chartOfAccounts', href: '#' },
          { translationKey: 'Navigation.items.financialEvents', href: '#' },
          { translationKey: 'Navigation.items.accountingPeriods', href: '#' },
          { translationKey: 'Navigation.items.journalEntries', href: '#' },
          { translationKey: 'Navigation.items.taxParameters', href: '#' },
        ],
      },
      {
        icon: Receipt,
        translationKey: 'Navigation.items.invoicesAndFees',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.ACCOUNTANT,
          ROLE_SLUGS.RECEPTIONIST,
        ],
        children: [
          { translationKey: 'Navigation.items.invoices', href: '#' },
          { translationKey: 'Navigation.items.purchaseInvoices', href: '#' },
          { translationKey: 'Navigation.items.treatmentPricing', href: '#' },
          { translationKey: 'Navigation.items.eDocuments', href: '#' },
        ],
      },
      {
        icon: CreditCard,
        translationKey: 'Navigation.items.paymentsAndPos',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.ACCOUNTANT,
          ROLE_SLUGS.RECEPTIONIST,
        ],
        children: [
          { translationKey: 'Navigation.items.paymentGateways', href: '#' },
          { translationKey: 'Navigation.items.posTransactions', href: '#' },
        ],
      },
      {
        icon: Banknote,
        translationKey: 'Navigation.items.cashAndBank',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.ACCOUNTANT,
        ],
        children: [
          { translationKey: 'Navigation.items.bankAccounts', href: '#' },
          { translationKey: 'Navigation.items.cashRegister', href: '#' },
          { translationKey: 'Navigation.items.financialLedger', href: '#' },
          { translationKey: 'Navigation.items.partyAccounts', href: '#' },
        ],
      },
      {
        icon: Briefcase,
        translationKey: 'Navigation.items.payroll',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.ACCOUNTANT,
        ],
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.supplyAndOperations',
    items: [
      {
        icon: Boxes,
        translationKey: 'Navigation.items.stockAndInventory',
        badge: '!',
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.INVENTORY_MANAGER,
          ROLE_SLUGS.ASSISTANT,
        ],
      },
      {
        icon: PackagePlus,
        translationKey: 'Navigation.items.procurement',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.INVENTORY_MANAGER,
        ],
      },
      {
        icon: Wrench,
        translationKey: 'Navigation.items.workOrders',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.INVENTORY_MANAGER,
          ROLE_SLUGS.PROVIDER,
        ],
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.humanResources',
    items: [
      {
        icon: Contact2,
        translationKey: 'Navigation.items.staffList',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
        ],
      },
      {
        icon: CalendarDays,
        translationKey: 'Navigation.items.timeAndAttendance',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
        ],
      },
      {
        icon: ShieldCheck,
        translationKey: 'Navigation.items.leaveManagement',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
        ],
      },
    ],
  },
  {
    groupKey: 'Navigation.groups.managementAndSettings',
    items: [
      {
        icon: Building2,
        translationKey: 'Navigation.items.company',
        badge: null,
        roles: [ROLE_SLUGS.ADMIN, ROLE_SLUGS.ORGANIZATION_OWNER],
      },
      {
        icon: Store,
        translationKey: 'Navigation.items.clinic',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
          ROLE_SLUGS.BRANCH_MANAGER,
        ],
      },
      {
        icon: Settings,
        translationKey: 'Navigation.items.users',
        badge: null,
        roles: [
          ROLE_SLUGS.ADMIN,
          ROLE_SLUGS.ORGANIZATION_OWNER,
          ROLE_SLUGS.CLINIC_OWNER,
        ],
      },
    ],
  },
];
