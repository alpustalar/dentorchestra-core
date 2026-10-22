import { Module } from '@nestjs/common';
import { PayrollPresentationModule } from './presentation/presentation.module';
import { PayrollCommandModule } from '@modules/finance/payroll/application/commands/command.module';
import { PayrollQueryModule } from '@modules/finance/payroll/application/queries/query.module';

@Module({
  imports: [
    PayrollPresentationModule,
    PayrollCommandModule,
    PayrollQueryModule,
  ],
})
export class PayrollModule {}
