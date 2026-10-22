import { QueryResponse } from '@shared/common/response/response.interface';
import { PayrollAccrual } from '@modules/finance/payroll/domain/contracts/payroll.contracts';

export type GetPayrollAccrualsResponse = QueryResponse<PayrollAccrual[]>;
