import { Pagination, StockMovement as IStockMovement } from '@shared';
import { BatchQuantityDriftLine } from '@modules/supply/inventory/domain/contracts/stock-movement/stock-movement-queries.contracts';

export const STOCK_MOVEMENT_QUERY_REPOSITORY = Symbol(
  'IStockMovementQueryRepository'
);

/** Okuma tarafı: entity değil, plain model döner (veri HTTP sınırını geçiyor). */
export interface IStockMovementQueryRepository {
  findManyByClinic(
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IStockMovement[]; total: number }>;
  findManyByProduct(
    productId: string,
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IStockMovement[]; total: number }>;

  /**
   * Parti miktarı ↔ hareket toplamı sapması olan partiler.
   *
   * `paginate` **kullanılmaz**: bu bir liste ekranı değil, türetilmiş alanın
   * sapma raporudur ve yalnız **eşit olmayan** satırları döndürür (sağlıklı
   * sistemde boş küme). Sayfalanırsa para birimi başına değer etkisi yalnız o
   * sayfanın toplamı olur ve "değerlemenin tabanı ne kadar kaymış" sorusu
   * yanıtlanamaz.
   */
  getBatchQuantityDrift(clinicId: string): Promise<BatchQuantityDriftLine[]>;
}
