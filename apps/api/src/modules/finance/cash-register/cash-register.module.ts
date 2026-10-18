import { Module } from '@nestjs/common';
import { CashRegisterPresentationModule } from './presentation/presentation.module';
import { CashRegisterCommandModule } from '@modules/finance/cash-register/application/commands/command.module';
import { CashRegisterQueryModule } from '@modules/finance/cash-register/application/queries/query.module';

@Module({
  imports: [
    CashRegisterPresentationModule,
    CashRegisterCommandModule,
    CashRegisterQueryModule,
  ],
})
export class CashRegisterModule {}
