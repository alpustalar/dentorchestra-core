import { Module } from '@nestjs/common';
import { InvoicePresentationModule } from './presentation/presentation.module';
import { InvoiceCommandModule } from '@modules/finance/invoice/application/commands/command.module';
import { InvoiceQueryModule } from '@modules/finance/invoice/application/queries/query.module';
import { InvoiceEventModule } from '@modules/finance/invoice/infrastructure/messaging/events/invoice-event.module';

@Module({
  imports: [
    InvoicePresentationModule,
    InvoiceCommandModule,
    InvoiceQueryModule,
    InvoiceEventModule,
  ],
})
export class InvoiceModule {}
