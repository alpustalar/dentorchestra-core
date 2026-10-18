import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreatePurchaseOrderCommand } from './create-purchase-order.command';
import {
  IPurchaseOrderCommandRepository,
  PURCHASE_ORDER_COMMAND_REPOSITORY,
} from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import {
  IPurchaseRequestCommandRepository,
  PURCHASE_REQUEST_COMMAND_REPOSITORY,
} from '@modules/supply/purchasing/domain/repositories/purchase-request.repository';
import { PurchaseOrder } from '@modules/supply/purchasing/domain/entities/purchase-order.entity';
import {
  PurchaseRequestClinicMismatchException,
  PurchaseRequestNotFoundException,
} from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import {
  IInventoryCatalogService,
  INVENTORY_CATALOG_SERVICE,
} from '@modules/supply/inventory/domain/services/catalog/inventory-catalog.service.interface';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';

@CommandHandler(CreatePurchaseOrderCommand)
export class CreatePurchaseOrderHandler implements ICommandHandler<
  CreatePurchaseOrderCommand,
  string
> {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepo: IPurchaseOrderCommandRepository,
    @Inject(PURCHASE_REQUEST_COMMAND_REPOSITORY)
    private readonly purchaseRequestRepo: IPurchaseRequestCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver,
    @Inject(INVENTORY_CATALOG_SERVICE)
    private readonly inventoryCatalog: IInventoryCatalogService,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CreatePurchaseOrderCommand): Promise<string> {
    const { data, ctx } = command;
    const { actor } = ctx;

    const organizationId = await this.tenantScopeResolver.resolve(data);

    this.policyFactory
      .purchasing(actor, ctx.source)
      .evaluator.check((p) => p.canManageClinicPurchasing(data.clinicId))
      .orThrow('purchase-order.create');

    // Tedarikçi ve katalog ürünleri bu kliniğe ait ve kullanılabilir olmalı:
    // ikisi de bounded-context gereği FK'siz skaler olarak taşınıyor, yani DB
    // doğrulamıyor. Doğrulama **siparişten önce** yapılır; mal kabulde yapılsa
    // sipariş yazılmış, gönderilmiş ve teslim alınmaya çalışılırken reddedilirdi.
    await this.inventoryCatalog.assertSupplierUsable({
      clinicId: data.clinicId,
      supplierId: data.supplierId,
    });

    const productIds = data.items
      .map((item) => item.productId)
      .filter((productId): productId is string => !!productId);

    if (productIds.length > 0) {
      await this.inventoryCatalog.assertProductsUsable({
        clinicId: data.clinicId,
        productIds,
      });
    }

    const order = PurchaseOrder.create({
      clinicId: data.clinicId,
      organizationId,
      supplierId: data.supplierId,
      purchaseRequestId: data.purchaseRequestId,
      expectedDate: data.expectedDate,
      note: data.note,
      items: data.items,
    });

    return this.txManager.run(async () => {
      // Onaylı talepten oluşturuluyorsa talebi ORDERED işaretle (atomik).
      if (data.purchaseRequestId) {
        const request = await this.purchaseRequestRepo.findByIdForUpdate(
          data.purchaseRequestId
        );
        if (!request) {
          throw new PurchaseRequestNotFoundException(data.purchaseRequestId);
        }

        // Talep siparişin kliniğine ait olmalı. Yetki kontrolü `data.clinicId`
        // üzerinden yapılıyor; talebin kliniği doğrulanmadığı sürece aktör kendi
        // kliniğinde sipariş açarken **başka bir kiracının** onaylı talebini
        // ORDERED'a çekebiliyordu (o klinikte talep bir daha siparişe
        // dönüştürülemez hâle gelirdi) ve sipariş yabancı bir talebe bağlanırdı.
        if (request.clinicId.value !== data.clinicId) {
          throw new PurchaseRequestClinicMismatchException({
            requestClinicId: request.clinicId.value,
            orderClinicId: data.clinicId,
          });
        }

        request.markOrdered();
        await this.purchaseRequestRepo.update(request);
      }

      const saved = await this.purchaseOrderRepo.create(order);
      return saved.id.value;
    });
  }
}
