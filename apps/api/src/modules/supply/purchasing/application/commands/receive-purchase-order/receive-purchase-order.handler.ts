import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ReceivePurchaseOrderCommand } from './receive-purchase-order.command';
import {
  IPurchaseOrderCommandRepository,
  PURCHASE_ORDER_COMMAND_REPOSITORY,
} from '@modules/supply/purchasing/domain/repositories/purchase-order.repository';
import { PurchaseOrderNotFoundException } from '@modules/supply/purchasing/domain/exceptions/purchasing.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { ReceiveStockCommand } from '@modules/supply/inventory/application/commands/receive-stock/receive-stock.command';

/**
 * Mal kabul — teslim alınan miktarları siparişe işler ve katalog ürünü satırları için
 * `ReceiveStockCommand` ile stok girişi tetikler (cross-module: purchasing → inventory).
 * Hepsi tek transaction içinde (nested run ALS tx'ini paylaşır) → atomik.
 */
@CommandHandler(ReceivePurchaseOrderCommand)
export class ReceivePurchaseOrderHandler implements ICommandHandler<
  ReceivePurchaseOrderCommand,
  void
> {
  constructor(
    @Inject(PURCHASE_ORDER_COMMAND_REPOSITORY)
    private readonly purchaseOrderRepo: IPurchaseOrderCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ReceivePurchaseOrderCommand): Promise<void> {
    const { orderId, data, ctx } = command.payload;

    await this.txManager.run(async () => {
      // Kilitli okuma: `quantityReceived` kümülatif sayaçtır, iki eşzamanlı kabul
      // kilitsiz okursa ikisi de aynı kalan miktarı görüp çift stok girişi yapar.
      const order = await this.purchaseOrderRepo.findByIdForUpdate(orderId);
      if (!order) throw new PurchaseOrderNotFoundException(orderId);

      this.policyFactory
        .purchasing(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.canManageClinicPurchasing(order.clinicId.value)
        )
        .orThrow('purchase-order.receive');

      // Kabul günlüğüne kimin girdiği de yazılır (GRNI dayanağı); sistem aktörü
      // kimliksizdir ve açıkça null geçer.
      order.receive(
        data.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
        })),
        { receivedById: ctx.actor.userId ?? null }
      );
      await this.purchaseOrderRepo.update(order);

      // Katalog ürünü satırları → stok girişi. Katalog-dışı (productId yok) atlanır.
      for (const receipt of data.items) {
        const line = order.getLine(receipt.itemId);
        if (!line || !line.productId) continue;

        await this.commandBus.execute(
          new ReceiveStockCommand(
            order.clinicId.value,
            {
              productId: line.productId,
              supplierId: order.supplierId.value,
              quantity: receipt.quantity,
              purchasePrice: line.unitPrice.toNumber(),
              currency: order.currency,
              vatRate: line.vatRate,
              lotNumber: receipt.lotNumber ?? null,
              expiresAt: receipt.expiresAt ?? null,
              notes: null,
            },
            ctx
          )
        );
      }
    });
  }
}
