import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { PAYMENT_EVENT_PUBLISHER } from '@modules/finance/payment/domain/interfaces/payment-event-publisher.interface';
import { PaymentEventPublisher } from '@modules/finance/payment/infrastructure/messaging/events/payment-event-publisher.service';
import { PaymentLifecycleListener } from '@modules/finance/payment/infrastructure/messaging/events/listeners/payment-lifecycle.listener';

@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [
    {
      provide: PAYMENT_EVENT_PUBLISHER,
      useClass: PaymentEventPublisher,
    },
    PaymentLifecycleListener,
  ],
  exports: [PAYMENT_EVENT_PUBLISHER],
})
export class PaymentEventModule {}
