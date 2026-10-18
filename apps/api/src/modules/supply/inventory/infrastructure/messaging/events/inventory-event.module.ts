import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { StockMovementRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/stock-movement/stock-movement.repository.module';
import { StockQuantityChangedListener } from './listeners';

export const INVENTORY_LISTENERS = [StockQuantityChangedListener];

@Module({
  // CqrsModule: dinleyici hareketi deftere köprülerken `RecordFinancialEventCommand`
  // gönderiyor (modüller arası yazma yalnız CommandBus ile).
  imports: [CqrsModule, StockMovementRepositoryModule],
  providers: [...INVENTORY_LISTENERS],
})
export class InventoryEventModule {}
