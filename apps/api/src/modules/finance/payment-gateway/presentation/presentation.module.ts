import { Module } from '@nestjs/common';
import { ClinicPaymentGatewayQueryController } from '@modules/finance/payment-gateway/presentation/http/controllers/payment-gateway.query.controller';
import { ClinicPaymentGatewayCommandController } from '@modules/finance/payment-gateway/presentation/http/controllers/payment-gateway.command.controller';

@Module({
  controllers: [
    ClinicPaymentGatewayQueryController,
    ClinicPaymentGatewayCommandController,
  ],
})
export class ClinicPaymentGatewayPresentationModule {}
