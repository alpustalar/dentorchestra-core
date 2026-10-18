import { QueryResponse } from '@shared/common/response/response.interface';
import { BatchQuantityDriftReport } from '@modules/supply/inventory/domain/contracts/stock-movement/stock-movement-queries.contracts';

export type GetBatchQuantityDriftResponse =
  QueryResponse<BatchQuantityDriftReport>;
