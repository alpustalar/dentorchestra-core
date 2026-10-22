import { Module } from '@nestjs/common';
import { GetPayrollAccrualsHandler } from './get-payroll-accruals/get-payroll-accruals.handler';
import { GetPayrollAccrualByIdHandler } from './get-payroll-accrual-by-id/get-payroll-accrual-by-id.handler';

const QueryHandlers = [GetPayrollAccrualsHandler, GetPayrollAccrualByIdHandler];

@Module({
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class PayrollQueryModule {}
