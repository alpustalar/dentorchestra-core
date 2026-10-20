import { AppointmentEvent } from '@src/domain/constants/events/appointment.constant';
import { ClinicEvent } from '@src/domain/constants/events/clinic.constant';
import { UserEvent } from '@src/domain/constants/events/user.constant';
import { OrganizationEvent } from '@src/domain/constants/events/organization.constant';
import { PaymentEvent } from '@src/domain/constants/events/payment.constant';
import { ProviderEvent } from '@src/domain/constants/events/provider.constant';
import { PatientEvent } from '@src/domain/constants/events/patient.constant';
import { ThrottleEvent } from '@src/domain/constants/events/throttle.constant';
import { TreatmentEvent } from '@src/domain/constants/events/treatment.constant';
import {
  PatientTreatmentPackageEvent,
  TreatmentPackageEvent,
} from '@src/domain/constants/events/treatment-package.constant';
import { SubscriptionEvent } from '@src/domain/constants/events/subscription.constant';
import { InvoiceEvent } from '@src/domain/constants/events/invoice.constant';
import { PurchaseInvoiceEvent } from '@src/domain/constants/events/purchase-invoice.constant';
import { PaymentGatewayEvent } from '@src/domain/constants/events/payment-gateway.constant';
import { PosEvent } from '@src/domain/constants/events/pos.constant';
import { MetaAdsEvent } from '@src/domain/constants/events/meta-ads.constant';
import { LeadEvent } from '@src/domain/constants/events/lead.constant';
import { InventoryEvent } from '@src/domain/constants/events/inventory.constant';
import { AdminRequestEvent } from '@src/domain/constants/events/admin-request.constant';
import { SecurityEvent } from '@src/domain/constants/events/security.constant';
import { FinanceLedgerEvent } from '@src/domain/constants/events/finance-ledger.constant';
import { FinancialEventEvent } from '@src/domain/constants/events/financial-event.constant';
import { GovernanceEvent } from '@src/domain/constants/events/governance.constant';
import { MessagingEvent } from '@src/domain/constants/events/messaging.constant';
import {
  BookingPaymentRefundEvent,
  HealthTourismConfigEvent,
} from '@src/domain/constants/events/health-tourism.constant';
import { LeaveEvent } from '@src/domain/constants/events/leave.constant';
import { EmployeeEvent } from '@src/domain/constants/events/employee.constant';
import { AttendanceEvent } from '@src/domain/constants/events/attendance.constant';
import {
  ConsentFormEvent,
  ConsentTemplateEvent,
} from '@src/domain/constants/events/consent-form.constant';
import { WorkOrderEvent } from '@src/domain/constants/events/work-order.constant';

export type AppEventName =
  | AppointmentEvent
  | ClinicEvent
  | ProviderEvent
  | OrganizationEvent
  | PatientEvent
  | PaymentEvent
  | ThrottleEvent
  | TreatmentEvent
  | TreatmentPackageEvent
  | UserEvent
  | SubscriptionEvent
  | InvoiceEvent
  | PurchaseInvoiceEvent
  | PaymentGatewayEvent
  | PosEvent
  | MetaAdsEvent
  | LeadEvent
  | InventoryEvent
  | AdminRequestEvent
  | SecurityEvent
  | FinanceLedgerEvent
  | FinancialEventEvent
  | GovernanceEvent
  | MessagingEvent
  | PatientTreatmentPackageEvent
  | HealthTourismConfigEvent
  | BookingPaymentRefundEvent
  | LeaveEvent
  | EmployeeEvent
  | AttendanceEvent
  | ConsentTemplateEvent
  | ConsentFormEvent
  | WorkOrderEvent;

export * from './appointment.constant';
export * from './clinic.constant';
export * from './provider.constant';
export * from './organization.constant';
export * from './patient.constant';
export * from './payment.constant';
export * from './throttle.constant';
export * from './treatment.constant';
export * from './treatment-package.constant';
export * from './treatment-charge.constant';
export * from './user.constant';
export * from './subscription.constant';
export * from './invoice.constant';
export * from './purchase-invoice.constant';
export * from './payment-gateway.constant';
export * from './pos.constant';
export * from './meta-ads.constant';
export * from './lead.constant';
export * from './inventory.constant';
export * from './admin-request.constant';
export * from './security.constant';
export * from './finance-ledger.constant';
export * from './financial-event.constant';
export * from './governance.constant';
export * from '@src/domain/constants/events/messaging.constant';
export * from './activity.constant';
export * from './health-tourism.constant';
export * from './leave.constant';
export * from './employee.constant';
export * from './attendance.constant';
export * from './consent-form.constant';
export * from './work-order.constant';
export * from './pipeline.constant';
export * from './accounting.constant';
export * from './ops.constant';
