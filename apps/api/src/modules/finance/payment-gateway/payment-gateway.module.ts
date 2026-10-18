import { Module } from '@nestjs/common';
import { ClinicPaymentGatewayPresentationModule } from './presentation/presentation.module';
import { ClinicPaymentGatewayCommandModule } from '@modules/finance/payment-gateway/application/commands/command.module';
import { ClinicPaymentGatewayQueryModule } from '@modules/finance/payment-gateway/application/queries/query.module';

@Module({
  imports: [
    ClinicPaymentGatewayPresentationModule,
    ClinicPaymentGatewayCommandModule,
    ClinicPaymentGatewayQueryModule,
  ],
})
export class PaymentGatewayModule {}
