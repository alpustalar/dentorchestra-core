import {
  IProductBatchCommandRepository,
  PRODUCT_BATCH_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product-batch/product-batch.command.repository';
import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { RecordProductUsageCommand } from './record-product-usage.command';
import { Decimal } from 'decimal.js';
import {
  NoAvailableStockException,
  ProductNotFoundException,
  ProductNotUsableInClinicException,
} from '@modules/supply/inventory/domain/exceptions/inventory.exceptions';
import { findProductUnusableReason } from '@modules/supply/inventory/domain/rules/catalog-usability.rules';
import { ProductUsage } from '@modules/supply/inventory/domain/entities/product-usage.entity';
import {
  IProductUsageCommandRepository,
  PRODUCT_USAGE_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product-usage/product-usage.command.repository';
import { Quantity } from '@src/domain/value-objects/quantity.vo';
import { StockMovementTypeSchema } from '@shared';
import { UUID } from '@src/domain/value-objects/uuid.vo';
import {
  IProductCommandRepository,
  PRODUCT_COMMAND_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.command.repository';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(RecordProductUsageCommand)
export class RecordProductUsageHandler implements ICommandHandler<
  RecordProductUsageCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_COMMAND_REPOSITORY)
    private readonly productRepo: IProductCommandRepository,
    @Inject(PRODUCT_BATCH_COMMAND_REPOSITORY)
    private readonly productBatchRepo: IProductBatchCommandRepository,
    @Inject(PRODUCT_USAGE_COMMAND_REPOSITORY)
    private readonly productUsageRepo: IProductUsageCommandRepository,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: RecordProductUsageCommand): Promise<void> {
    const { clinicId, dto, ctx } = command;
    const { actor } = ctx;

    const quantity = new Decimal(dto.quantity);

    // Kapsam kontrolü: `CapabilityGuard` yalnız yeteneğe bakar (stockmovement:create),
    // kiracıya bakmaz — `clinicId` URL'den geldiği için başka bir kiracının stoğu
    // bu uçtan düşülebilirdi. İşlem izni yetenekte, kiracı sınırı burada.
    const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

    this.policyFactory
      .clinic(ctx.actor, ctx.source)
      .evaluator.check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(clinicId, organizationId)
      )
      .orThrow('inventory.stock.usage');

    // Ürün satırı FOR UPDATE ile kilitlenir, partiler kilit altında okunup düşülür:
    // aksi halde aynı ürüne eşzamanlı iki kullanım aynı parti bakiyesini okuyup
    // ayrı ayrı düşer → lost update (stok olduğundan fazla görünür).
    //
    // outboxRun: stok hareketi kaydı düşümün defteridir; olay kaybolursa bakiye
    // düşer ama izi kalmaz. Olay, miktarla aynı transaction'da outbox'a mühürlenir.
    await this.txManager.outboxRun(async () => {
      const product = await this.productRepo.findByIdForUpdate(dto.productId);
      if (!product) throw new ProductNotFoundException();

      // Ürün bu klinikte kullanılabilir olmalı — aynı kural mal kabulde, sayım
      // düzeltmesinde ve sipariş kapısında da zorlanıyor.
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

      // Parti **daima** bu ürünün tüketilebilir partileri arasından seçilir.
      // `findById(dto.batchId)` çağrılıyordu: istemci başka bir ürünün — hatta
      // başka bir kliniğin — parti kimliğini geçince o partiden düşülüyordu
      // (kapsam kontrolü yok), ayrıca SKT'si geçmiş parti de tüketilebiliyordu.
      const available = await this.productBatchRepo.findAvailableByProduct(
        product.id.value,
        clinicId
      );

      const batch = dto.batchId
        ? (available.find((b) => b.id.value === dto.batchId) ?? null)
        : (available[0] ?? null);

      if (!batch) {
        throw new NoAvailableStockException({ productId: dto.productId });
      }

      // Hareket kimliği burada üretilir: tüketim kaydı onu taşıyarak hareketle
      // eşleşir (hareket kaydını dinleyici yazar, kimliği olaydan alır).
      const movementId = UUID.generate().value;

      batch.deductQuantity({
        qty: quantity,
        // Hareket tipi **USAGE**: varsayılan `ADJUSTMENT` idi, yani tedavide
        // tüketilen malzeme defterde "sayım düzeltmesi" olarak görünüyordu.
        // Tip artık hem hareket raporunu hem muhasebe eşlemesini belirliyor
        // (USAGE → 740.01 hizmet üretim maliyeti, ADJUSTMENT → 689 açık).
        movementType: StockMovementTypeSchema.enum.USAGE,
        movementId,
        performedById: actor.userId,
        notes: dto.notes,
      });

      // Hareket kaydı yan etkidir: batch yazılırken olay boşalır, dinleyici yazar.
      await this.productBatchRepo.update(batch);

      // Tüketimin **sebebi** (hangi randevu, hangi parti) yalnız bu kayıtta
      // durur. Uç `appointmentId` alıyor ama hiçbir yere yazmıyordu: tedavinin
      // malzeme maliyeti bu yüzden hiç hesaplanamıyordu.
      await this.productUsageRepo.create(
        ProductUsage.create({
          productId: product.id.value,
          clinicId,
          batchId: batch.id.value,
          appointmentId: dto.appointmentId,
          quantity: Quantity.createPositive(quantity, 'Tüketim').orThrow(),
          stockMovementId: movementId,
          notes: dto.notes,
        })
      );
    });
  }
}
