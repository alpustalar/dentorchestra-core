import { Module } from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  RouterModule,
} from '@nestjs/core';
import { LoggingInterceptor } from '@common/interceptors/logger/logger.interceptor';
import { AllExceptionsFilter } from '@src/infrastructure/http/filters/all-exceptions-filter';
import { ThrottleMonitorGuard } from '@common/guards/throttle-monitor.guard';
import { ThrottleMonitorListener } from '@common/guards/throttle-monitor.listener';
import { UserModule } from '@modules/identity/user/user.module';
import { PrismaModule } from '@src/infrastructure/persistence/prisma/prisma.module';
import { TenantScopeModule } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.module';
import { KernelHealthModule, RedisHealthIndicator } from '@src/http';
import { PrismaHealthIndicator } from '@src/infrastructure/health/prisma-health.indicator';
import { MongoPersistenceModule } from '@src/infrastructure/persistence/mongo/mongo-persistence.module';
import { CoreTransportModule } from '@src/infrastructure/transport/core-transport.module';
import { FirebaseModule } from '@src/infrastructure/firebase/firebase.module';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { AppointmentModule } from '@modules/clinical/appointment/appointment.module';
import { ClinicModule } from '@modules/organization/clinic/clinic.module';
import { PatientModule } from '@modules/crm/patient/patient.module';
import { TreatmentModule } from '@modules/clinical/treatment/treatment.module';
import { OrganizationModule } from '@modules/organization/organization/organization.module';
import { MedicalFilesModule } from '@modules/clinical/medical-files/medical-files.module';
import { AuthModule } from '@modules/identity/auth/auth/auth.module';
import { RegistrationModule } from '@modules/identity/auth/registration/registration.module';
import { RoleModule } from '@modules/identity/role/role.module';
import { InfrastructureModule } from '@src/infrastructure/infrastructure.module';
import { ProviderModule } from '@modules/clinical/provider/provider.module';
import { TransactionInterceptor } from '@common/interceptors/transaction/transaction.interceptor';
import { APP_ROUTES } from '@src/app.routes';
import { ExecutionSourceInterceptor } from '@common/interceptors/execution-source/execution-source.interceptor';
import { FinanceLedgerModule } from '@modules/finance/finance-ledger/finance-ledger.module';
import { TreatmentPackageModule } from '@modules/clinical/treatment-package/treatment-package.module';
import { OutboxModule } from '@src/infrastructure/persistence/prisma/outbox/outbox.module';
import { PatientAuthModule } from '@modules/identity/auth/patient-auth/patient-auth.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { TSCqrsModule } from '@common/cqrs/type-safe-cqrs.module';
import { CryptoModule } from '@src/infrastructure/security/crypto/crypto.module';
import { TreatmentChargeModule } from '@modules/finance/treatment-charge/treatment-charge.module';
import { InvoiceModule } from '@modules/finance/invoice/invoice.module';
import { PosModule } from '@modules/finance/pos/pos.module';
import { PaymentModule } from '@modules/finance/payment/payment.module';
import { AccountingModule } from '@modules/finance/accounting/accounting.module';
import { PartyModule } from '@modules/finance/party/party.module';
import { PaymentGatewayModule } from '@modules/finance/payment-gateway/payment-gateway.module';
import { PurchaseInvoiceModule } from '@modules/finance/purchase-invoice/purchase-invoice.module';
import { PayrollModule } from '@modules/finance/payroll/payroll.module';
import { EDocumentModule } from '@modules/finance/e-document/e-document.module';
import { MetaAdsModule } from '@modules/crm/meta-ads/meta-ads.module';
import { LeadModule } from '@modules/crm/lead/lead.module';
import { PipelineModule } from '@modules/crm/pipeline/pipeline.module';
import { ActivityModule } from '@modules/crm/activity/activity.module';
import { AdminRequestModule } from '@modules/platform/admin-request/admin-request.module';
import { HealthTourismModule } from '@modules/crm/health-tourism/health-tourism.module';
import { GovernanceModule } from '@modules/organization/clinic-governance/governance.module';
import { InventoryModule } from '@modules/supply/inventory/inventory.module';
import { NotificationModule } from '@modules/platform/notification/notification.module';
import { MailModule } from '@src/infrastructure/mail/mail.module';
import { EmployeeModule } from '@modules/hr/employee/employee.module';
import { LeaveModule } from '@modules/hr/leave/leave.module';
import { AttendanceModule } from '@modules/hr/attendance/attendance.module';
import { PurchasingModule } from '@modules/supply/purchasing/purchasing.module';
import { CashRegisterModule } from '@modules/finance/cash-register/cash-register.module';
import { BankModule } from '@modules/finance/bank/bank.module';
import { ConsentFormModule } from '@modules/clinical/consent-form/consent-form.module';
import { WorkOrderModule } from '@modules/supply/work-order/work-order.module';
import { ProjectModule } from '@modules/organization/project/project.module';
import { CriticalFailureModule } from '@common/observability/critical-failure.module';
import { SubscriptionModule } from '@modules/platform/subscription/subscription.module';

@Module({
  imports: [
    InfrastructureModule,
    ContextModule,
    CryptoModule,
    RouterModule.register(APP_ROUTES),
    FirebaseModule,
    PrismaModule,
    TenantScopeModule,
    MongoPersistenceModule,
    // Readiness: api'nin işini yapamayacağı iki bağımlılık. Mongo YOK — orası
    // yalnız audit log tutuyor, erişilemediğinde api istekleri karşılamayı
    // sürdürür (log kaybı, hizmet kaybı değil).
    KernelHealthModule.forRoot({
      indicators: [PrismaHealthIndicator, RedisHealthIndicator],
    }),
    CoreTransportModule,
    AuthModule,
    TSCqrsModule,
    UserModule,
    MailModule.forRoot(),
    AuditLogModule,
    AppointmentModule,
    FinanceLedgerModule,
    OutboxModule,
    ClinicModule,
    PatientModule,
    PatientAuthModule,
    TreatmentModule,
    TreatmentPackageModule,
    ProviderModule,
    OrganizationModule,
    MedicalFilesModule,
    RoleModule,
    RegistrationModule,
    InvoiceModule,
    TreatmentChargeModule,
    PosModule,
    PaymentModule,
    AccountingModule,
    PartyModule,
    PaymentGatewayModule,
    PurchaseInvoiceModule,
    PayrollModule,
    EDocumentModule,
    GovernanceModule,
    MetaAdsModule,
    LeadModule,
    PipelineModule,
    ActivityModule,
    AdminRequestModule,
    HealthTourismModule,
    InventoryModule,
    NotificationModule,
    CriticalFailureModule,
    EmployeeModule,
    LeaveModule,
    AttendanceModule,
    PurchasingModule,
    CashRegisterModule,
    BankModule,
    ConsentFormModule,
    WorkOrderModule,
    ProjectModule,
    SubscriptionModule,
  ],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: ExecutionSourceInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: ThrottleMonitorGuard },
    ThrottleMonitorListener,
  ],
})
export class AppModule {}
