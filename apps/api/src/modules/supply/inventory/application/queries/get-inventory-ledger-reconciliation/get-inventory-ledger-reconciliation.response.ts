import { QueryResponse } from '@shared/common/response/response.interface';
import { InventoryLedgerReconciliation } from '@modules/supply/inventory/domain/contracts';

export type GetInventoryLedgerReconciliationResponse =
  QueryResponse<InventoryLedgerReconciliation>;
