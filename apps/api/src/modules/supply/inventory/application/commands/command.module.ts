import { Module } from '@nestjs/common';
import { InventoryDomainServicesModule } from '@modules/supply/inventory/domain/services/services.module';

import { CreateProductHandler } from './create-product/create-product.handler';
import { UpdateProductHandler } from './update-product/update-product.handler';
import { SoftDeleteProductHandler } from './soft-delete-product/soft-delete-product.handler';
import { CreateSupplierHandler } from './create-supplier/create-supplier.handler';
import { UpdateSupplierHandler } from './update-supplier/update-supplier.handler';
import { CreateProductCategoryHandler } from './create-product-category/create-product-category.handler';
import { ReceiveStockHandler } from './receive-stock/receive-stock.handler';
import { AdjustStockHandler } from './adjust-stock/adjust-stock.handler';
import { RecordProductUsageHandler } from './record-product-usage/record-product-usage.handler';
import { InventoryInfrastructureModule } from '@modules/supply/inventory/infrastructure/infrastructure.module';

export const INVENTORY_COMMAND_HANDLERS = [
  CreateProductHandler,
  UpdateProductHandler,
  SoftDeleteProductHandler,
  CreateSupplierHandler,
  UpdateSupplierHandler,
  CreateProductCategoryHandler,
  ReceiveStockHandler,
  AdjustStockHandler,
  RecordProductUsageHandler,
];

@Module({
  // Katalog kapısı (ürün/tedarikçi/kategori kullanılabilirliği) envanterin kendi
  // yaprak domain servis modülünden gelir.
  imports: [InventoryInfrastructureModule, InventoryDomainServicesModule],
  providers: [...INVENTORY_COMMAND_HANDLERS],
})
export class InventoryCommandModule {}
