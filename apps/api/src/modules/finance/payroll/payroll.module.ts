import { Module } from '@nestjs/common';
import { PayrollPresentationModule } from './presentation/presentation.module';
import { PayrollCommandModule } from '@modules/finance/payroll/application/commands/command.module';

@Module({ imports: [PayrollPresentationModule, PayrollCommandModule] })
export class PayrollModule {}
