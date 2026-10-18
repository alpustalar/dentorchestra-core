import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AdjustStockCommand } from './adjust-stock.command';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  ProductNotFoundException,
  ProductNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { findProductUnusableReason } from '@modules/supply/inventory/domain/rules/catalog-usability.rules';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { INVENTORY_EVENTS } from '@src/domain/constants/events';
import {
  IProductCommandRepository,
  PRODUCT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.command.repository';
import {
  IProductBatchCommandRepository,
  PRODUCT_BATCH_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product-batch/product-batch.command.repository';

@CommandHandler(AdjustStockCommand)
export class AdjustStockHandler implements ICommandHandler<
  AdjustStockCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepo: IProductCommandRepository,
    @Inject(PRODUCT_BATCH_COMMAND_REPOSITORY)
    private readonly productBatchRepo: IProductBatchCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: AdjustStockCommand): Promise<void> {
    const { clinicId, data, ctx } = command.payload;
    const { actor, source } = ctx;

    // Yetki, **yazmanın yapılacağı** klinik üzerinden değerlendirilir. Önceden
    // kontrol `product.clinicId` ile yapılıyordu: aktör kendi kliniğinin ürünü
    // üzerinde yetkili görünüp hareketi URL'den gelen `clinicId` ile
    // damgalayabiliyordu (iki klinik ayrışıyordu). `clinicId` istekle geldiği
    // için kiracı önce ondan çözülür.
    const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

    this.policyFactory
      .clinic(actor, source)
      .evaluator.check(
        (p) =>
          p.actorCanManageClinicOrOwnsOrganization(clinicId, organizationId),
        'Bu klinikte işlem yapma yetkiniz yok.'
      )
      .orThrow(INVENTORY_EVENTS.ADJUST_STOCK);

    const product = await this.productRepo.findById(data.productId);
    if (!product) throw new ProductNotFoundException();

    // Ürün bu klinikte kullanılabilir olmalı (başka kiracı / silinmiş / pasif):
    // aynı kural mal kabulde ve sipariş kapısında da zorlanıyor.
    const unusableReason = findProductUnusableReason(
      {
        id: product.id.value,
        clinicId: product.clinicId.value,
        isActive: product.isActive,
        deletedAt: product.deletedAt,
      },
      clinicId
    );
    if (unusableReason) {
      throw new ProductNotUsableInClinicException({
        productId: data.productId,
        reason: unusableReason,
      });
    }

    // Ürünü FOR UPDATE ile kilitle, sonra batch'leri kilit ALTINDA oku: aynı ürüne
    // eşzamanlı stok değişimlerini serialize eder. Aksi halde iki istek aynı batch
    // quantity'sini okuyup ayrı ayrı düşer → lost update (mevcut bakiyeyi bozar).
    //
    // outboxRun: stok hareketi kaydı miktar değişiminin defteridir; olay kaybolursa
    // bakiye değişir ama izi kalmaz. Bu yüzden olay, miktarla aynı transaction'da
    // outbox'a mühürlenir.
    await this.txManager.outboxRun(async () => {
      const lockedProduct = await this.productRepo.findByIdForUpdate(
        product.id.value
      );
      if (!lockedProduct) throw new ProductNotFoundException();

      const availableBatches =
        await this.productBatchRepo.findAvailableByProduct(
          lockedProduct.id.value,
          clinicId
        );

      const updatedBatch = lockedProduct.handleStockChange({
        quantityDelta: data.quantityDelta,
        clinicId,
        availableBatches,
        explicitBatchId: data.batchId,
        performedById: actor.userId,
        notes: data.notes,
      });

      await this.productBatchRepo.update(updatedBatch);
    });
  }
}
