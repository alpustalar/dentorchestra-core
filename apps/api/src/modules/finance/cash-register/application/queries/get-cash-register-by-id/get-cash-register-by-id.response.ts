import { QueryResponse } from '@shared/common/response/response.interface';
import { CashRegister } from '@model-schema/CashRegisterSchema';

export type GetCashRegisterByIdResponse = QueryResponse<CashRegister | null>;
