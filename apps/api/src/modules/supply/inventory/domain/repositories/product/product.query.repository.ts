import { Pagination, Product as IProduct } from '@shared';
import {
  InventoryValuationLine,
  StockLevel,
} from '@modules/supply/inventory/domain/contracts';

export const PRODUCT_QUERY_REPOSITORY = Symbol('IProductQueryRepository');

export interface IProductQueryRepository {
  /**
   * Kliniğin ürün kataloğu. Kapsam **klinik**: ürün `clinicId` taşır ve stok,
   * fiyat, tüketim hep klinik düzeyinde yürür. Organizasyon kapsamıyla
   * listelendiği sürece çok klinikli bir organizasyonda personel başka şubenin
   * kataloğunu görüyordu.
   */
  findMany(
    clinicId: string,
    pagination: Pagination
  ): Promise<{ items: IProduct[]; total: number }>;
  getStockLevels(clinicId: string): Promise<StockLevel[]>;
  getLowStockAlerts(clinicId: string): Promise<StockLevel[]>;

  /**
   * Eldeki stoğun parti bazlı fiili maliyeti — ürün × para birimi kırılımında.
   * Silinmiş ürünlerin stoğu da döner (işaretli): stok listeleri onları süzdüğü
   * için değerlemeden de düşerlerse 150 ile fark **sebebi görünmeden** doğar.
   */
  getInventoryValuation(clinicId: string): Promise<InventoryValuationLine[]>;
}
