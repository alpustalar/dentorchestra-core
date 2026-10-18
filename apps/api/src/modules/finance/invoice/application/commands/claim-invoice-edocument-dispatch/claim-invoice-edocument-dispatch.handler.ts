import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { ClaimInvoiceEDocumentDispatchCommand } from './claim-invoice-edocument-dispatch.command';
import {
  IInvoiceCommandRepository,
  INVOICE_COMMAND_REPOSITORY,
} from '@modules/finance/invoice/domain/repositories/invoice/invoice.command.repository';

@CommandHandler(ClaimInvoiceEDocumentDispatchCommand)
export class ClaimInvoiceEDocumentDispatchHandler implements ICommandHandler<
  ClaimInvoiceEDocumentDispatchCommand,
  boolean
> {
  constructor(
    @Inject(INVOICE_COMMAND_REPOSITORY)
    private readonly invoiceRepo: IInvoiceCommandRepository,
    private readonly txManager: TransactionManager
  ) {}

  execute(command: ClaimInvoiceEDocumentDispatchCommand): Promise<boolean> {
    // Tek koşullu UPDATE; okuma-sonra-yazma penceresi yok (bkz. repo yorumu).
    return this.txManager.run(() =>
      this.invoiceRepo.claimForEDocumentDispatch(command.invoiceId)
    );
  }
}
