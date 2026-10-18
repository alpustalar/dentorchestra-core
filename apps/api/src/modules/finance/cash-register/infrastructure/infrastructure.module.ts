import { Module } from '@nestjs/common';
import { CashRegisterRepositoriesModule } from '@modules/finance/cash-register/infrastructure/persistence/prisma/repositories/repositories.module';

const InfrastructureModules = [CashRegisterRepositoriesModule];
@Module({
  imports: [...InfrastructureModules],
  exports: [...InfrastructureModules],
})
export class CashRegisterInfrastructureModule {}
