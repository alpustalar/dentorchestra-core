import { Module } from '@nestjs/common';
import { ProductRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/product/product.repository.module';
import { ProductBatchRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/product-batch/product-batch.repository.module';
import { ProductCategoryRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/product-category/product-category.repository.module';
import { StockMovementRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/stock-movement/stock-movement.repository.module';
import { SupplierRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/supplier/supplier.repository.module';
import { ProductUsageRepositoryModule } from '@modules/supply/inventory/infrastructure/persistence/prisma/repositories/product-usage/product-usage.repository.module';

const InventoryRepositoriesModules = [
  ProductRepositoryModule,
  ProductBatchRepositoryModule,
  ProductCategoryRepositoryModule,
  StockMovementRepositoryModule,
  SupplierRepositoryModule,
  ProductUsageRepositoryModule,
];

@Module({
  imports: [...InventoryRepositoriesModules],
  exports: [...InventoryRepositoriesModules],
})
export class InventoryRepositoriesModule {}
