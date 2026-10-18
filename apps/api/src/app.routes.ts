import { Routes } from '@nestjs/core';
import { RegistrationModule } from '@modules/identity/auth/registration/registration.module';
import { OrganizationModule } from '@modules/organization/organization/organization.module';
import { ClinicModule } from '@modules/organization/clinic/clinic.module';
import { AppointmentModule } from '@modules/clinical/appointment/appointment.module';
import { UserModule } from '@modules/identity/user/user.module';
import { ProviderModule } from '@modules/clinical/provider/provider.module';
import { FinanceLedgerModule } from '@modules/finance/finance-ledger/finance-ledger.module';
import { PatientModule } from '@modules/crm/patient/patient.module';
import { SubscriptionModule } from '@modules/platform/subscription/subscription.module';
import { PosModule } from '@modules/finance/pos/pos.module';
import { PaymentModule } from '@modules/finance/payment/payment.module';
import { AccountingModule } from '@modules/finance/accounting/accounting.module';
import { PartyModule } from '@modules/finance/party/party.module';
import { PaymentGatewayModule } from '@modules/finance/payment-gateway/payment-gateway.module';
import { PurchaseInvoiceModule } from '@modules/finance/purchase-invoice/purchase-invoice.module';
import { InvoiceModule } from '@modules/finance/invoice/invoice.module';
import { PayrollModule } from '@modules/finance/payroll/payroll.module';
import { PatientAuthModule } from '@modules/identity/auth/patient-auth/patient-auth.module';
import { MetaAdsModule } from '@modules/crm/meta-ads/meta-ads.module';
import { LeadModule } from '@modules/crm/lead/lead.module';
import { LeadPresentationModule } from '@modules/crm/lead/presentation/presentation.module';
import { PipelineModule } from '@modules/crm/pipeline/pipeline.module';
import { ActivityModule } from '@modules/crm/activity/activity.module';
import { AdminRequestModule } from '@modules/platform/admin-request/admin-request.module';
import { HealthTourismModule } from '@modules/crm/health-tourism/health-tourism.module';
import { GovernanceModule } from '@modules/organization/clinic-governance/governance.module';
import { InventoryModule } from '@modules/supply/inventory/inventory.module';
import { NotificationModule } from '@modules/platform/notification/notification.module';
import { EmployeeModule } from '@modules/hr/employee/employee.module';
import { PurchasingModule } from '@modules/supply/purchasing/purchasing.module';
import { CashRegisterModule } from '@modules/finance/cash-register/cash-register.module';
import { BankModule } from '@modules/finance/bank/bank.module';
import { WorkOrderModule } from '@modules/supply/work-order/work-order.module';
import { ProjectModule } from '@modules/organization/project/project.module';
import { OrganizationPresentationModule } from '@modules/organization/organization/presentation/presentation.module';
import { ClinicPresentationModule } from '@modules/organization/clinic/presentation/presentation.module';
import { AppointmentPresentationModule } from '@modules/clinical/appointment/presentation/presentation.module';
import { UserPresentationModule } from '@modules/identity/user/presentation/presentation.module';
import { ProviderPresentationModule } from '@modules/clinical/provider/presentation/provider-presentation.module';
import { PatientPresentationModule } from '@modules/crm/patient/presentation/presentation.module';
import { FinanceLedgerPresentationModule } from '@modules/finance/finance-ledger/presentation/presentation.module';
import { RegistrationPresentationModule } from '@modules/identity/auth/registration/presentation/presentation.module';
import { SubscriptionPresentationModule } from '@modules/platform/subscription/presentation/presentation.module';
import { PaymentPresentationModule as VirtualPosPaymentPresentationModule } from '@modules/finance/pos/virtual/presentation/payment-presentation.module';
import { PaymentPresentationModule } from '@modules/finance/payment/presentation/presentation.module';
import { PhysicalPosPresentationModule } from '@modules/finance/pos/physical/presentation/presentation.module';
import { AccountingPeriodPresentationModule } from '@modules/finance/accounting/periods/presentation/presentation.module';
import { ChartOfAccountsPresentationModule } from '@modules/finance/accounting/chart-of-accounts/presentation/presentation.module';
import { FinancialEventPresentationModule } from '@modules/finance/accounting/financial-events/presentation/presentation.module';
import { PostingPresentationModule } from '@modules/finance/accounting/posting/presentation/presentation.module';
import { TaxParameterPresentationModule } from '@modules/finance/accounting/tax-parameters/presentation/presentation.module';
import { PartyPresentationModule } from '@modules/finance/party/presentation/presentation.module';
import { ClinicPaymentGatewayPresentationModule } from '@modules/finance/payment-gateway/presentation/presentation.module';
import { PurchaseInvoicePresentationModule } from '@modules/finance/purchase-invoice/presentation/presentation.module';
import { InvoicePresentationModule } from '@modules/finance/invoice/presentation/presentation.module';
import { PayrollPresentationModule } from '@modules/finance/payroll/presentation/presentation.module';
import { GovernancePresentationModule } from '@modules/organization/clinic-governance/presentation/governance-presentation.module';
import { MetaAdsPresentationModule } from '@modules/crm/meta-ads/presentation/presentation.module';
import { PipelinePresentationModule } from '@modules/crm/pipeline/presentation/presentation.module';
import { ActivityPresentationModule } from '@modules/crm/activity/presentation/activity.presentation.module';
import { AdminRequestPresentationModule } from '@modules/platform/admin-request/presentation/presentation.module';
import { BookingPaymentPresentationModule } from '@modules/crm/health-tourism/booking-payment/presentation/presentation.module';
import { HealthTourismConfigPresentationModule } from '@modules/crm/health-tourism/config/presentation/presentation.module';
import { HealthTourismPresentationModule } from '@modules/crm/health-tourism/presentation/presentation.module';
import { InventoryPresentationModule } from '@modules/supply/inventory/presentation/presentation.module';
import { NotificationPresentationModule } from '@modules/platform/notification/presentation/presentation.module';
import { EmployeePresentationModule } from '@modules/hr/employee/presentation/presentation.module';
import { PurchasingPresentationModule } from '@modules/supply/purchasing/presentation/presentation.module';
import { CashRegisterPresentationModule } from '@modules/finance/cash-register/presentation/presentation.module';
import { BankPresentationModule } from '@modules/finance/bank/presentation/presentation.module';
import { WorkOrderPresentationModule } from '@modules/supply/work-order/presentation/presentation.module';
import { ProjectPresentationModule } from '@modules/organization/project/presentation/project.presentation.module';
import { LeaveModule } from '@modules/hr/leave/leave.module';
import { LeavePresentationModule } from '@modules/hr/leave/presentation/presentation.module';
import { AttendanceModule } from '@modules/hr/attendance/attendance.module';
import { AttendancePresentationModule } from '@modules/hr/attendance/presentation/presentation.module';
import { ConsentFormModule } from '@modules/clinical/consent-form/consent-form.module';
import { ConsentFormPresentationModule } from '@modules/clinical/consent-form/presentation/presentation.module';

export const APP_ROUTES: Routes = [
  {
    path: 'organizations',
    module: OrganizationModule,
    children: [OrganizationPresentationModule],
  },
  {
    path: 'clinics',
    module: ClinicModule,
    children: [ClinicPresentationModule],
  },
  {
    path: 'appointments',
    module: AppointmentModule,
    children: [AppointmentPresentationModule],
  },
  {
    path: 'users',
    module: UserModule,
    children: [UserPresentationModule],
  },
  {
    path: 'providers',
    module: ProviderModule,
    children: [ProviderPresentationModule],
  },
  {
    path: 'patients',
    module: PatientModule,
    children: [PatientPresentationModule],
  },
  {
    path: 'finance',
    module: FinanceLedgerModule,
    children: [FinanceLedgerPresentationModule],
  },
  {
    path: 'register',
    module: RegistrationModule,
    children: [RegistrationPresentationModule],
  },
  {
    path: 'subscription',
    module: SubscriptionModule,
    children: [SubscriptionPresentationModule],
  },
  {
    path: 'pos',
    module: PosModule,
    children: [
      VirtualPosPaymentPresentationModule,
      PhysicalPosPresentationModule,
    ],
  },
  {
    path: 'payment',
    module: PaymentModule,
    children: [PaymentPresentationModule],
  },
  {
    path: 'accounting',
    module: AccountingModule,
    children: [
      AccountingPeriodPresentationModule,
      ChartOfAccountsPresentationModule,
      FinancialEventPresentationModule,
      PostingPresentationModule,
      TaxParameterPresentationModule,
    ],
  },
  {
    path: 'parties',
    module: PartyModule,
    children: [PartyPresentationModule],
  },
  {
    path: 'payment-gateways',
    module: PaymentGatewayModule,
    children: [ClinicPaymentGatewayPresentationModule],
  },
  {
    path: 'purchase-invoices',
    module: PurchaseInvoiceModule,
    children: [PurchaseInvoicePresentationModule],
  },
  {
    path: 'invoices',
    module: InvoiceModule,
    children: [InvoicePresentationModule],
  },
  {
    path: 'payroll',
    module: PayrollModule,
    children: [PayrollPresentationModule],
  },
  {
    path: 'governance',
    module: GovernanceModule,
    children: [GovernancePresentationModule],
  },
  {
    path: 'patient-auth',
    module: PatientAuthModule,
  },
  {
    path: 'meta-ads',
    module: MetaAdsModule,
    children: [MetaAdsPresentationModule],
  },
  {
    path: 'leads',
    module: LeadModule,
    children: [LeadPresentationModule],
  },
  {
    path: 'pipelines',
    module: PipelineModule,
    children: [PipelinePresentationModule],
  },
  {
    path: 'activities',
    module: ActivityModule,
    children: [ActivityPresentationModule],
  },
  {
    path: 'admin-requests',
    module: AdminRequestModule,
    children: [AdminRequestPresentationModule],
  },
  {
    path: 'health-tourism',
    module: HealthTourismModule,
    children: [
      BookingPaymentPresentationModule,
      HealthTourismConfigPresentationModule,
      HealthTourismPresentationModule,
    ],
  },
  {
    path: 'inventory',
    module: InventoryModule,
    children: [InventoryPresentationModule],
  },
  {
    path: 'notifications',
    module: NotificationModule,
    children: [NotificationPresentationModule],
  },
  {
    path: 'employees',
    module: EmployeeModule,
    children: [EmployeePresentationModule],
  },
  {
    path: 'purchasing',
    module: PurchasingModule,
    children: [PurchasingPresentationModule],
  },
  {
    path: 'cash',
    module: CashRegisterModule,
    children: [CashRegisterPresentationModule],
  },
  {
    path: 'bank',
    module: BankModule,
    children: [BankPresentationModule],
  },
  {
    path: 'work-orders',
    module: WorkOrderModule,
    children: [WorkOrderPresentationModule],
  },

  {
    path: 'project-management',
    module: ProjectModule,
    children: [ProjectPresentationModule],
  },
  {
    path: 'leaves',
    module: LeaveModule,
    children: [LeavePresentationModule],
  },
  {
    path: 'attendance',
    module: AttendanceModule,
    children: [AttendancePresentationModule],
  },
  {
    path: 'consent-forms',
    module: ConsentFormModule,
    children: [ConsentFormPresentationModule],
  },
];
