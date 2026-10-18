import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { MarkInvoiceEDocumentFailedCommand } from './mark-invoice-edocument-failed.command';
import {
  IInvoiceCommandRepository,
  INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.command.repository';
import { InvoiceNotFoundException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';

@CommandHandler(MarkInvoiceEDocumentFailedCommand)
export class MarkInvoiceEDocumentFailedHandler implements ICommandHandler<
  MarkInvoiceEDocumentFailedCommand,
  void
> {
  constructor(
    @Inject(INVOICE_COMMAND_REPOSITORY)
    private readonly invoiceRepo: IInvoiceCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MarkInvoiceEDocumentFailedCommand): Promise<void> {
    const { invoiceId, reason, ctx } = command.payload;

    await this.txManager.run(async () => {
      const invoice = await this.invoiceRepo.findByIdForUpdate(invoiceId);
      if (!invoice) {
        throw new InvoiceNotFoundException(invoiceId);
      }

      invoice.markEDocumentFailed({
        reason,
        source: ctx.actor.source,
        actorId: ctx.actor.userId,
      });

      await this.invoiceRepo.update(invoice);
    });
  }
}
