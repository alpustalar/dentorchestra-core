import { Module } from '@nestjs/common';
import { InvoiceQueryController } from '@modules/finance/invoice/presentation/http/controllers/invoice.query.controller';
import { InvoiceCommandController } from '@modules/finance/invoice/presentation/http/controllers/invoice.command.controller';

@Module({ controllers: [InvoiceQueryController, InvoiceCommandController] })
export class InvoicePresentationModule {}
