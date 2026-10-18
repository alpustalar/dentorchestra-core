import { ProductUsage } from '@modules/supply/inventory/domain/entities/product-usage.entity';

export const PRODUCT_USAGE_COMMAND_REPOSITORY = Symbol(
  'IProductUsageCommandRepository'
);

/**
 * NOT: Query repo yok — tüketim kaydı bugün yalnız yazılıyor (tedavi maliyeti
 * raporu geldiğinde düz kayıt döndüren bir `...QueryRepository` eklenir).
 * Kayıt değişmez: düzeltme ters hareketle yapılır, satır güncellenmez.
 */
export interface IProductUsageCommandRepository {
  create(usage: ProductUsage): Promise<ProductUsage>;
}
