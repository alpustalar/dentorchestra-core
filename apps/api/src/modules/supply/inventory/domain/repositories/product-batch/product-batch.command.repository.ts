import { Decimal } from 'decimal.js';
import { ProductBatch } from '../../entities/product-batch.entity';
import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';

export const PRODUCT_BATCH_COMMAND_REPOSITORY = Symbol(
  'IProductBatchCommandRepository'
);

/**
 * NOT: Parti (batch) için Query Repo yoktur — partiler yalnız stok düşümü/artışı
 * akışında, ürün satırı `FOR UPDATE` ile kilitliyken okunur. Okumanın tamamı bir
 * mutasyonu beslediği için Command Context'e aittir. Dışarıya gösterilen stok
 * verisi `IProductQueryRepository.getStockLevels` üzerinden gider.
 */
export interface IProductBatchCommandRepository extends IBaseCommandRepository<ProductBatch> {
  /**
   * Ürünün tüketilebilir partileri (FEFO sırasında). Yalnız kilit altında çağrılır;
   * dönen partiler aynı transaction içinde güncellenir.
   */
  findAvailableByProduct(
    productId: string,
    clinicId: string
  ): Promise<ProductBatch[]>;

  /**
   * Ürünün (tüm partilerindeki) eldeki toplam miktarı. Ürün silinmeden önce
   * "üzerinde stok var mı" kararını besler — bir yazma kararı olduğu için
   * Command Repo'da durur.
   */
  sumOnHandByProduct(productId: string): Promise<Decimal>;
}
