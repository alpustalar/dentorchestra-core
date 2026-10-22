import { IQuery } from '@nestjs/cqrs';
import { IGetContext } from '@common/decorators';
import { GetPayrollAccrualByIdResponse } from './get-payroll-accrual-by-id.response';

export class GetPayrollAccrualByIdQuery implements IQuery {
  readonly __responseType!: GetPayrollAccrualByIdResponse;
  constructor(
    public readonly financialEventId: string,
    public readonly ctx: IGetContext
  ) {}
}
