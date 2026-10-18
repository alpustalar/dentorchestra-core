import { Inject, Injectable } from '@nestjs/common';
import {
  AssertCategoryUsableParams,
  AssertProductsUsableParams,
  AssertSupplierUsableParams,
  IInventoryCatalogService,
} from '@modules/supply/inventory/domain/services/catalog/inventory-catalog.service.interface';
import {
  IProductCommandRepository,
  PRODUCT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.command.repository';
import {
  ISupplierCommandRepository,
  SUPPLIER_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/supplier/supplier.command.repository';
import {
  IProductCategoryCommandRepository,
  PRODUCT_CATEGORY_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product-category/product-category.command.repository';
import {
  CategoryNotUsableInClinicException,
  ProductCategoryNotFoundException,
  ProductNotFoundException,
  ProductNotUsableInClinicException,
  SupplierNotFoundException,
  SupplierNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import {
  findProductUnusableReason,
  findSupplierUnusableReason,
} from '@modules/supply/inventory/domain/rules/catalog-usability.rules';

@Injectable()
export class InventoryCatalogService implements IInventoryCatalogService {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productCommandRepo: IProductCommandRepository,
    @Inject(SUPPLIER_COMMAND_REPOSITORY)
    private readonly supplierCommandRepo: ISupplierCommandRepository,
    @Inject(PRODUCT_CATEGORY_COMMAND_REPOSITORY)
    private readonly categoryCommandRepo: IProductCategoryCommandRepository
  ) {}

  async assertCategoryUsable(
    params: AssertCategoryUsableParams
  ): Promise<void> {
    const category = await this.categoryCommandRepo.findById(params.categoryId);
    if (!category) throw new ProductCategoryNotFoundException();

    if (category.clinicId.value !== params.clinicId) {
      throw new CategoryNotUsableInClinicException({
        categoryId: params.categoryId,
        reason: 'OTHER_CLINIC',
      });
    }
  }

  async assertSupplierUsable(
    params: AssertSupplierUsableParams
  ): Promise<void> {
    const supplier = await this.supplierCommandRepo.findById(params.supplierId);
    if (!supplier) throw new SupplierNotFoundException(params.supplierId);

    const reason = findSupplierUnusableReason(
      {
        id: supplier.id.value,
        clinicId: supplier.clinicId.value,
        isActive: supplier.isActive,
      },
      params.clinicId
    );

    if (reason) {
      throw new SupplierNotUsableInClinicException({
        supplierId: params.supplierId,
        reason,
      });
    }
  }

  async assertProductsUsable(
    params: AssertProductsUsableParams
  ): Promise<void> {
    // Aynı ürün birden çok satırda geçebilir (farklı lot/fiyat); her satır için
    // ayrı okuma yapmak gereksiz.
    const uniqueIds = [...new Set(params.productIds)];

    for (const productId of uniqueIds) {
      const product = await this.productCommandRepo.findById(productId);
      if (!product) throw new ProductNotFoundException();

      const reason = findProductUnusableReason(
        {
          id: product.id.value,
          clinicId: product.clinicId.value,
          isActive: product.isActive,
          deletedAt: product.deletedAt,
        },
        params.clinicId
      );

      if (reason) {
        throw new ProductNotUsableInClinicException({ productId, reason });
      }
    }
  }
}
