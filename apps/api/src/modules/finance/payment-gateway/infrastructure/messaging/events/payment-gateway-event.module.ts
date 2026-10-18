import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { ClinicPaymentGatewayRegisteredListener } from '@modules/finance/payment-gateway/infrastructure/messaging/events/listeners/clinic-payment-gateway-registered.listener';

@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [ClinicPaymentGatewayRegisteredListener],
})
export class PaymentGatewayEventModule {}
