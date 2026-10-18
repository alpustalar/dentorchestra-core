import { Module } from '@nestjs/common';
import { RecordPayrollAccrualHandler } from './record-payroll-accrual/record-payroll-accrual.handler';
import { AccountingPeriodDomainServicesModule } from '@modules/finance/accounting/periods/domain/services/services.module';

const CommandHandlers = [RecordPayrollAccrualHandler];

@Module({
  // Tahakkuk tarihi kullanıcıdan geliyor → dönem kapısı (yaprak modül).
  imports: [AccountingPeriodDomainServicesModule],
  providers: [...CommandHandlers],
  exports: [...CommandHandlers],
})
export class PayrollCommandModule {}
