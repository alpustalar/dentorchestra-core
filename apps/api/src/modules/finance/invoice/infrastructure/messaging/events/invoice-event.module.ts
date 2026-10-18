import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { PaymentPaidInvoiceListener } from './listeners/payment-paid.listener';
import { AppointmentCompletedInvoiceListener } from './listeners/appointment-completed.listener';
import { InvoiceDocumentLifecycleListener } from './listeners/invoice-document-lifecycle.listener';

@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [
    PaymentPaidInvoiceListener,
    AppointmentCompletedInvoiceListener,
    InvoiceDocumentLifecycleListener,
  ],
})
export class InvoiceEventModule {}
