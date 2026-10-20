import { Module } from '@nestjs/common';
import { GetPurchaseInvoicesHandler } from './get-purchase-invoices/get-purchase-invoices.handler';
import { GetPurchaseInvoiceAmountsByOrderHandler } from './get-purchase-invoice-amounts-by-order/get-purchase-invoice-amounts-by-order.handler';
import { PurchaseInvoiceInfrastructureModule } from '@modules/finance/purchase-invoice/infrastructure/infrastructure.module';

const QueryHandlers = [
  GetPurchaseInvoicesHandler,
  GetPurchaseInvoiceAmountsByOrderHandler,
];

@Module({
  imports: [PurchaseInvoiceInfrastructureModule],
  providers: [...QueryHandlers],
})
export class PurchaseInvoiceQueryModule {}
