import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UnmatchPurchaseInvoiceCommand } from './unmatch-purchase-invoice.command';
import {
  IPurchaseInvoiceCommandRepository,
  PURCHASE_INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/purchase-invoice/domain/repositories/purchase-invoice.repository';
import { PurchaseInvoiceNotFoundException } from '@modules/finance/purchase-invoice/domain/exceptions/purchase-invoice.exceptions';
import { RevertInvoiceFromPurchaseOrderCommand } from '@modules/supply/purchasing/application/commands/revert-invoice-from-purchase-order/revert-invoice-from-purchase-order.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(UnmatchPurchaseInvoiceCommand)
export class UnmatchPurchaseInvoiceHandler implements ICommandHandler<
  UnmatchPurchaseInvoiceCommand,
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

  async execute(command: UnmatchPurchaseInvoiceCommand): Promise<void> {
    const { invoiceId, ctx } = command;

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

      const previousOrderId = invoice.unmatchFromOrder();
      await this.purchaseInvoiceCommandRepo.update(invoice);

      await this.commandBus.execute(
        new RevertInvoiceFromPurchaseOrderCommand({
          orderId: previousOrderId,
          invoiceId: invoice.id.value,
          grandTotal: invoice.grandTotal.value.toFixed(2),
          ctx,
        })
      );
    });
  }
}
