import { Module } from '@nestjs/common';
import { ChargeTotalsServiceModule } from '@modules/finance/treatment-charge/domain/services/charge-totals';
import { IssueInvoiceHandler } from './issue-invoice/issue-invoice.handler';
import { MarkInvoiceEDocumentResultHandler } from './mark-invoice-edocument-result/mark-invoice-edocument-result.handler';
import { ClaimInvoiceEDocumentDispatchHandler } from './claim-invoice-edocument-dispatch/claim-invoice-edocument-dispatch.handler';
import { MarkInvoiceEDocumentFailedHandler } from './mark-invoice-edocument-failed/mark-invoice-edocument-failed.handler';
import { BackfillMissingInvoicesHandler } from './backfill-missing-invoices/backfill-missing-invoices.handler';
import { CancelInvoiceHandler } from './cancel-invoice/cancel-invoice.handler';
import { InvoiceInfrastructureModule } from '@modules/finance/invoice/infrastructure/infrastructure.module';

export const INVOICE_COMMAND_HANDLERS = [
  IssueInvoiceHandler,
  MarkInvoiceEDocumentResultHandler,
  ClaimInvoiceEDocumentDispatchHandler,
  MarkInvoiceEDocumentFailedHandler,
  BackfillMissingInvoicesHandler,
  CancelInvoiceHandler,
];

@Module({
  // İptalin muhasebe bacağı (storno) ve entegratör iptal bildirimi CommandBus
  // üzerinden dispatch edilir → hedef modüller BURADA import EDİLMEZ (bkz.
  // CLAUDE.md modüller arası iletişim kuralı); handler'ları kendi modüllerinde
  // kayıtlıdır.
  imports: [InvoiceInfrastructureModule, ChargeTotalsServiceModule],
  providers: INVOICE_COMMAND_HANDLERS,
  exports: INVOICE_COMMAND_HANDLERS,
})
export class InvoiceCommandModule {}
