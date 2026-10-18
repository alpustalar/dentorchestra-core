import { Module } from '@nestjs/common';
import { ClinicPaymentGatewayRepositoriesModule } from '@modules/finance/payment-gateway/infrastructure/persistence/prisma/repositories/repositories.module';
import { PaymentGatewayEventModule } from '@modules/finance/payment-gateway/infrastructure/messaging/events/payment-gateway-event.module';

const InfrastructureModules = [
  ClinicPaymentGatewayRepositoriesModule,
  PaymentGatewayEventModule,
];

@Module({
  imports: [...InfrastructureModules],
  exports: [...InfrastructureModules],
})
export class ClinicPaymentGatewayInfrastructureModule {}
