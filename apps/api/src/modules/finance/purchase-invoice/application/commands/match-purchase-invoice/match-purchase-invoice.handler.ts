import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { MatchPurchaseInvoiceCommand } from './match-purchase-invoice.command';
import {
  IPurchaseInvoiceCommandRepository,
  PURCHASE_INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import { PurchaseInvoiceNotFoundException } from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import { ApplyInvoiceToPurchaseOrderCommand } from '@modules/supply/purchasing/application/commands/apply-invoice-to-purchase-order/apply-invoice-to-purchase-order.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

/**
 * Kaydedilmiş faturayı sonradan bir siparişe eşleştirir. Bağ kurma (fatura) ve
 * sayaç güncelleme (sipariş) tek transaction'da yürür: sipariş tarafındaki tutar
 * kontrolü patlarsa fatura üzerindeki bağ da geri sarılır, aksi halde faturaya
 * bağlı ama sayacı artmamış bir sipariş kalırdı.
 */
@CommandHandler(MatchPurchaseInvoiceCommand)
export class MatchPurchaseInvoiceHandler implements ICommandHandler<
  MatchPurchaseInvoiceCommand,
  void
> {
  constructor(
    @Inject(PURCHASE_INVOICE_COMMAND_REPOSITORY)
    private readonly purchaseInvoiceCommandRepo: IPurchaseInvoiceCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly commandBus: TSCommandBus,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MatchPurchaseInvoiceCommand): Promise<void> {
    const { invoiceId, data, ctx } = command.payload;

    await this.txManager.run(async () => {
      // Kilitli okuma: eşleştirme kararı siparişin kümülatif sayacını besliyor.
      const invoice =
        await this.purchaseInvoiceCommandRepo.findByIdForUpdate(invoiceId);
      if (!invoice) throw new PurchaseInvoiceNotFoundException(invoiceId);

      this.policyFactory
        .clinic(ctx.actor, ctx.source)
        .evaluator.check((p) =>
          p.actorCanAccessClinicOrOwnsOrganization(
            invoice.clinicId.value,
            invoice.organizationId.value
          )
        )
        .orThrow();

      invoice.matchToOrder(data.purchaseOrderId);
      await this.purchaseInvoiceCommandRepo.update(invoice);

      await this.commandBus.execute(
        new ApplyInvoiceToPurchaseOrderCommand({
          orderId: data.purchaseOrderId,
          invoiceId: invoice.id.value,
          clinicId: invoice.clinicId.value,
          supplierId: invoice.supplierId.value,
          grandTotal: invoice.grandTotal.value.toFixed(2),
          currency: invoice.currency,
          ctx,
        })
      );
    });
  }
}
