import { Module } from '@nestjs/common';
import { CashRegisterQueryController } from '@modules/finance/cash-register/presentation/http/controllers/cash-register.query.controller';
import { CashRegisterCommandController } from '@modules/finance/cash-register/presentation/http/controllers/cash-register.command.controller';
import { CashSessionQueryController } from '@modules/finance/cash-register/presentation/http/controllers/cash-session.query.controller';
import { CashSessionCommandController } from '@modules/finance/cash-register/presentation/http/controllers/cash-session.command.controller';

@Module({
  controllers: [
    CashRegisterQueryController,
    CashRegisterCommandController,
    CashSessionQueryController,
    CashSessionCommandController,
  ],
})
export class CashRegisterPresentationModule {}
