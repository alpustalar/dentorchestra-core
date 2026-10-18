import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ReceiveStockCommand } from './receive-stock.command';
import { StockMovement } from '@modules/supply/inventory/domain/entities/stock-movement.entity';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { ProductBatch } from '@modules/supply/inventory/domain/entities/product-batch.entity';
import {
  LogAction,
  LogSource,
  LogType,
} from '@src/domain/constants/log-action.constant';
import { StockMovementDirectionSchema, StockMovementTypeSchema } from '@shared';
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { Money } from '@src/domain/value-objects/money.vo';
import {
  ProductNotFoundException,
  ProductNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { findProductUnusableReason } from '@modules/supply/inventory/domain/rules/catalog-usability.rules';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IProductCommandRepository,
  PRODUCT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.command.repository';
import {
  IProductBatchCommandRepository,
  PRODUCT_BATCH_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product-batch/product-batch.command.repository';
import {
  IStockMovementCommandRepository,
  STOCK_MOVEMENT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/stock-movement/stock-movement.command.repository';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(ReceiveStockCommand)
export class ReceiveStockHandler implements ICommandHandler<
  ReceiveStockCommand,
  string
> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepo: IProductCommandRepository,
    @Inject(PRODUCT_BATCH_COMMAND_REPOSITORY)
    private readonly productBatchRepo: IProductBatchCommandRepository,
    @Inject(STOCK_MOVEMENT_COMMAND_REPOSITORY)
    private readonly stockMovementRepo: IStockMovementCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ReceiveStockCommand): Promise<string> {
    const { clinicId, dto, ctx } = command;
    const { actor } = ctx;

    // Kiracı, aktörden DEĞİL partinin yazıldığı klinikten türetilir: `clinicId`
    // istekle geliyor, aktörün organizasyonu ona damgalanırsa başka bir kiracının
    // kliniğine ait parti yanlış organizasyonla kaydedilebilirdi.
    const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

    // Kapsam kontrolü: `CapabilityGuard` yalnız "bu aktörde stockmovement:create
    // var mı" der, hangi kiracının kliniği olduğuna bakmaz. Mal kabulün kendisine
    // izin verme kararı yetenekte kalır; burada yalnız kiracı sınırı doğrulanır.
    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(clinicId, organizationId)
      )
      .orThrow('inventory.stock.receive');

    const product = await this.productRepo.findById(dto.productId);
    if (!product) throw new ProductNotFoundException();

    // Ürünün bu klinikte kullanılabilir olması zorunlu. Yoksa parti `clinicId`
    // bu kliniğe yazılırken **başka kliniğin** ürün kaydına bağlanıyordu: iki
    // tarafın listeleri de kendi kliniğiyle süzdüğü için parti hiçbir ekranda
    // görünmüyor, ödenen mal bedeli envanter değerinden düşüyordu. Silinmiş /
    // pasif ürün de aynı sonuca yol açar (listeler `deletedAt: null` süzer) —
    // kural 10: okunmayan bayrak kolonu güvence değil süstür.
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
        productId: dto.productId,
        reason: unusableReason,
      });
    }

    const batch = ProductBatch.createFromPurchase({
      productId: product.id.value,
      clinicId,
      organizationId: UUID.create(organizationId).orThrow().value,
      supplierId: dto.supplierId ?? null,
      lotNumber: dto.lotNumber ?? null,
      expiresAt: dto.expiresAt ?? null,
      quantity: Quantity.create(dto.quantity).orThrow(),
      purchasePrice: Money.create(dto.purchasePrice, dto.currency).orThrow(),
      notes: dto.notes ?? null,
      eventPayload: {
        action: LogAction.INVENTORY_STOCK_RECEIVE,
        source: LogSource.WEB,
        type: LogType.INFO,
        actorId: actor.userId,
      },
    });

    const stockMovement = StockMovement.create({
      productId: product.id.value,
      clinicId,
      batchId: batch.id.value,
      type: StockMovementTypeSchema.enum.PURCHASE,
      direction: StockMovementDirectionSchema.enum.IN,
      quantity: dto.quantity,
      unitPrice: Money.create(dto.purchasePrice, dto.currency).instance,
      vatRate: dto.vatRate ?? null,
      performedById: actor.userId,
      notes: dto.notes ?? null,
    });

    return this.txManager.run(async () => {
      await this.productBatchRepo.create(batch);
      await this.stockMovementRepo.create(stockMovement);
      return batch.id.value;
    });
  }
}
