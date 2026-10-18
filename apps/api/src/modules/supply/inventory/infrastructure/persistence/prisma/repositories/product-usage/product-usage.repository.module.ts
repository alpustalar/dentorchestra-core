import { Module } from '@nestjs/common';
import { ProductUsageCommandRepository } from './product-usage.command.repository';
import { PRODUCT_USAGE_COMMAND_REPOSITORY } from '@modules/supply/inventory/domain/repositories/product-usage/product-usage.command.repository';

@Module({
  providers: [
    {
      provide: PRODUCT_USAGE_COMMAND_REPOSITORY,
      useClass: ProductUsageCommandRepository,
    },
  ],
  exports: [PRODUCT_USAGE_COMMAND_REPOSITORY],
})
export class ProductUsageRepositoryModule {}
