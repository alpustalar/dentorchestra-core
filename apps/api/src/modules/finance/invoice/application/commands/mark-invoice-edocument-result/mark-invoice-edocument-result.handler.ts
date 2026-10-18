import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { MarkInvoiceEDocumentResultCommand } from './mark-invoice-edocument-result.command';
import {
  IInvoiceCommandRepository,
  INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.command.repository';
import { InvoiceNotFoundException } from '@modules/finance/invoice/domain/exceptions/invoice.exceptions';

/**
 * e-Belge sonucunu faturaya işler ve PENDING faturayı ISSUED'a finalize eder.
 *
 * Fatura **kilit altında** okunur: aynı faturaya iki sonuç yarışabilir (job retry,
 * elle yeniden tetikleme). Kilit + entity'deki numara-değişmezliği guard'ı birlikte,
 * ikinci sonucun belge numarasını sessizce değiştirmesini imkânsız kılar.
 */
@CommandHandler(MarkInvoiceEDocumentResultCommand)
export class MarkInvoiceEDocumentResultHandler implements ICommandHandler<
  MarkInvoiceEDocumentResultCommand,
  void
> {
  constructor(
    @Inject(INVOICE_COMMAND_REPOSITORY)
    private readonly invoiceRepo: IInvoiceCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: MarkInvoiceEDocumentResultCommand): Promise<void> {
    const { input, ctx } = command;

    await this.txManager.run(async () => {
      const invoice = await this.invoiceRepo.findByIdForUpdate(input.invoiceId);
      if (!invoice) {
        throw new InvoiceNotFoundException(input.invoiceId);
      }

      invoice.applyEDocumentResult({
        documentType: input.documentType,
        uuid: input.uuid,
        status: input.status,
        invoiceNumber: input.invoiceNumber,
        providerRef: input.providerRef,
        rawResponse: input.rawResponse,
        source: ctx.actor.source,
        actorId: ctx.actor.userId,
      });

      await this.invoiceRepo.update(invoice);
    });
  }
}
