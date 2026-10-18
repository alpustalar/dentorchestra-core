import { Module } from '@nestjs/common';
import { PurchaseInvoicePresentationModule } from './presentation/presentation.module';
import { PurchaseInvoiceCommandModule } from '@modules/finance/purchase-invoice/application/commands/command.module';
import { PurchaseInvoiceQueryModule } from '@modules/finance/purchase-invoice/application/queries/query.module';
import { PurchaseInvoiceEventModule } from '@modules/finance/purchase-invoice/infrastructure/messaging/events/purchase-invoice-event.module';

@Module({
  imports: [
    PurchaseInvoicePresentationModule,
    PurchaseInvoiceCommandModule,
    PurchaseInvoiceQueryModule,
    PurchaseInvoiceEventModule,
  ],
})
export class PurchaseInvoiceModule {}
