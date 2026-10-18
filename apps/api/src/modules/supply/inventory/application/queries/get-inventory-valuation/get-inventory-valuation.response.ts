import { QueryResponse } from '@shared/common/response/response.interface';
import { InventoryValuationReport } from '@modules/supply/inventory/domain/contracts';

export type GetInventoryValuationResponse =
  QueryResponse<InventoryValuationReport>;
