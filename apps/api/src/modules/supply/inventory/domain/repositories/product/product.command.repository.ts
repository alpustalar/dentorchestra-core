import { IBaseCommandRepository } from '@common/domain/repositories/base-command-repository.interface';
import { Product } from '@modules/supply/inventory/domain/entities/product.entity';

export const PRODUCT_COMMAND_REPOSITORY = Symbol('IProductCommandRepository');

export interface IProductCommandRepository extends IBaseCommandRepository<Product> {
  /**
   * Ürünü `FOR UPDATE` ile kilitleyerek yükler — o ürüne ait eşzamanlı stok
   * değişimlerini (batch quantity oku-değiştir-yaz) serialize eder, lost-update'i
   * önler. Yalnız aktif transaction içinde çağrılır.
   */
  findByIdForUpdate(id: string): Promise<Product | null>;
}
