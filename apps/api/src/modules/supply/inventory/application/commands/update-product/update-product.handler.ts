import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpdateProductCommand } from './update-product.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { ProductNotFoundException } from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import {
  IInventoryCatalogService,
  INVENTORY_CATALOG_SERVICE,
} from '@modules/supply/inventory/domain/services/catalog/inventory-catalog.service.interface';
import {
  IProductCommandRepository,
  PRODUCT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.command.repository';

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler implements ICommandHandler<
  UpdateProductCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepo: IProductCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(INVENTORY_CATALOG_SERVICE)
    private readonly catalog: IInventoryCatalogService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: UpdateProductCommand): Promise<void> {
    const { payload } = command;
    const { productId, data, ctx } = payload;

    const product = await this.productRepo.findById(productId);
    if (!product) throw new ProductNotFoundException();

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessTargetClinic(product.clinicId.value)
      )
      .orThrow();

    // Bağlar güncellemede de kiracıya kapalı olmalı: kapı yalnız oluşturmada
    // olsaydı aynı yabancı kayıt bir güncellemeyle bağlanabilirdi.
    if (data.categoryId) {
      await this.catalog.assertCategoryUsable({
        clinicId: product.clinicId.value,
        categoryId: data.categoryId,
      });
    }
    if (data.supplierId) {
      await this.catalog.assertSupplierUsable({
        clinicId: product.clinicId.value,
        supplierId: data.supplierId,
      });
    }

    product.update({
      name: data.name,
      barcode: data.barcode,
      brand: data.brand,
      description: data.description,
      unit: data.unit,
      vatRate: data.vatRate,
      criticalStockQty: data.criticalStockQty,
      reorderQty: data.reorderQty,
      categoryId: data.categoryId,
      supplierId: data.supplierId,
    });

    await this.txManager.run(async () => {
      await this.productRepo.update(product);
    });
  }
}
