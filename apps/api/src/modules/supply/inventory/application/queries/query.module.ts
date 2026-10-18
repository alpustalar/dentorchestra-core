import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { FindProductsHandler } from './find-products/find-products.handler';
import { FindSuppliersHandler } from './find-suppliers/find-suppliers.handler';
import { GetLowStockAlertsHandler } from './get-low-stock-alerts/get-low-stock-alerts.handler';
import { GetProductStockHandler } from './get-product-stock/get-product-stock.handler';
import { GetStockMovementsHandler } from './get-stock-movements/get-stock-movements.handler';
import { GetInventoryValuationHandler } from './get-inventory-valuation/get-inventory-valuation.handler';
import { GetInventoryLedgerReconciliationHandler } from './get-inventory-ledger-reconciliation/get-inventory-ledger-reconciliation.handler';
import { GetBatchQuantityDriftHandler } from './get-batch-quantity-drift/get-batch-quantity-drift.handler';
import { InventoryInfrastructureModule } from '@modules/supply/inventory/infrastructure/infrastructure.module';

export const INVENTORY_QUERY_HANDLERS = [
  FindProductsHandler,
  FindSuppliersHandler,
  GetLowStockAlertsHandler,
  GetProductStockHandler,
  GetStockMovementsHandler,
  GetInventoryValuationHandler,
  GetInventoryLedgerReconciliationHandler,
  GetBatchQuantityDriftHandler,
];

@Module({
  // CqrsModule: mutabakat sorgusu mizanı QueryBus üzerinden okuyor.
  imports: [CqrsModule, InventoryInfrastructureModule],
  providers: [...INVENTORY_QUERY_HANDLERS],
})
export class InventoryQueryModule {}
