import { Module } from '@nestjs/common';
import { TransferApplicationModule } from '@modules/crm/health-tourism/transfer/application/application.module';
import { TransferInfrastructureModule } from '@modules/crm/health-tourism/transfer/infrastructure/infrastructure.module';

@Module({
  imports: [TransferApplicationModule, TransferInfrastructureModule],
  exports: [TransferApplicationModule],
})
export class TransferModule {}
