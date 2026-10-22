import { Module } from '@nestjs/common';
import { PayrollCommandController } from '@modules/finance/payroll/presentation/http/controllers/payroll.command.controller';
import { PayrollQueryController } from '@modules/finance/payroll/presentation/http/controllers/payroll.query.controller';

@Module({ controllers: [PayrollCommandController, PayrollQueryController] })
export class PayrollPresentationModule {}
