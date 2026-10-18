import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { StockMovement } from '@modules/supply/inventory/domain/entities/stock-movement.entity';

export const STOCK_MOVEMENT_COMMAND_REPOSITORY = Symbol(
  'IStockMovementCommandRepository'
);
/**
 * Hareket kaydı **değişmez**: düzeltme ters hareketle yapılır, satır
 * güncellenmez. `IBaseCommandRepository`'nin `create`/`findById`/`update`
 * sözleşmesi yeterli (ekstra metot yok).
 */
export type IStockMovementCommandRepository =
  IBaseCommandRepository<StockMovement>;
