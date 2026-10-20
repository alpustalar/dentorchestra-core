import { QueryResponse } from '@shared/common/response/response.interface';
import { PosTransactionSummary } from '@modules/finance/pos/physical/domain/contracts/pos-transaction';

export type GetPosTransactionByIdResponse =
  QueryResponse<PosTransactionSummary | null>;
