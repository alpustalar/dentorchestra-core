import { Module } from '@nestjs/common';
import { ProductRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/product/product.repository.module';
import { SupplierRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/supplier/supplier.repository.module';
import { ProductCategoryRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/product-category/product-category.repository.module';
import { INVENTORY_CATALOG_SERVICE } from '@modules/supply/inventory/domain/services/catalog/inventory-catalog.service.interface';
import { InventoryCatalogService } from '@modules/supply/inventory/domain/services/catalog/inventory-catalog.service';

/**
 * Envanter domain servisleri — **yaprak** modül. Tüketici (satın alma) yalnız
 * bunu import eder; `InventoryModule`'ü import etmek controller'ları ve tüm
 * handler'ları da beraberinde çeker, modül grafiğini şişirir ve döngü riski
 * üretir (satın alma ↔ envanter zaten iki yönlü konuşuyor: mal kabul
 * `ReceiveStockCommand` ile envantere gider).
 */
@Module({
  imports: [
    ProductRepositoryModule,
    SupplierRepositoryModule,
    ProductCategoryRepositoryModule,
  ],
  providers: [
    { provide: INVENTORY_CATALOG_SERVICE, useClass: InventoryCatalogService },
  ],
  exports: [INVENTORY_CATALOG_SERVICE],
})
export class InventoryDomainServicesModule {}
