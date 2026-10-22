import { IQuery } from '@nestjs/cqrs';
import { Pagination } from '@shared';
import { IGetContext } from '@common/decorators';
import { GetPayrollAccrualsResponse } from './get-payroll-accruals.response';

export class GetPayrollAccrualsQuery implements IQuery {
  readonly __responseType!: GetPayrollAccrualsResponse;
  constructor(
    public readonly payload: {
      readonly clinicId: string;
      readonly employeeUserId?: string;
      readonly monthKey?: string;
      readonly pagination: Pagination;
      readonly ctx: IGetContext;
    }
  ) {}
}
