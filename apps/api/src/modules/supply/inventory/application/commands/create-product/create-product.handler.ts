import { Product } from '@modules/supply/inventory/domain/entities/product.entity';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { CreateProductCommand } from './create-product.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IProductCommandRepository,
  PRODUCT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.command.repository';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IInventoryCatalogService,
  INVENTORY_CATALOG_SERVICE,
} from '@modules/supply/inventory/domain/services/catalog/inventory-catalog.service.interface';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<
  CreateProductCommand,
  string
> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepo: IProductCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(INVENTORY_CATALOG_SERVICE)
    private readonly catalog: IInventoryCatalogService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CreateProductCommand): Promise<string> {
    const { data, ctx } = command;

    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(data.clinicId, organizationId)
      )
      .orThrow();

    if (data.categoryId) {
      await this.catalog.assertCategoryUsable({
        clinicId: data.clinicId,
        categoryId: data.categoryId,
      });
    }
    if (data.supplierId) {
      await this.catalog.assertSupplierUsable({
        clinicId: data.clinicId,
        supplierId: data.supplierId,
      });
    }

    // `vatRate` artık DTO'da **zorunlu**: sessiz `?? 0` varsayılanı, oranı
    // söylemeyen bir isteği "istisna kapsamında" sayıyordu. Ürünün oranı alış
    // faturasının 191 indirilecek KDV'sini besliyor; 0'a düşmek indirimi kimse
    // seçmemişken eksik kullandırır. Eşik alanları (kritik stok / sipariş
    // miktarı) para taşımadığı için 0 varsayılanı orada doğru kalıyor.
    const product = Product.create({
      ...data,
      criticalStockQty: data.criticalStockQty ?? 0,
      reorderQty: data.reorderQty ?? 0,
      organizationId,
    });

    return this.txManager.run(async () => {
      const saved = await this.productRepo.create(product);
      return saved.id.value;
    });
  }
}
