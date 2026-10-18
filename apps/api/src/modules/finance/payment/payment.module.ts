import { Module } from '@nestjs/common';
import { PaymentPresentationModule } from './presentation/presentation.module';
import { PaymentInfrastructureModule } from '@modules/finance/payment/infrastructure/infrastructure.module';
import { PaymentCommandModule } from '@modules/finance/payment/application/commands/command.module';
import { PaymentQueryModule } from '@modules/finance/payment/application/queries/query.module';

@Module({
  imports: [
    PaymentPresentationModule,
    PaymentInfrastructureModule,
    PaymentCommandModule,
    PaymentQueryModule,
  ],
  exports: [PaymentInfrastructureModule],
})
export class PaymentModule {}
