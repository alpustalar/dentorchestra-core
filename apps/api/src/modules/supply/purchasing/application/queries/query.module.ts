import { Module } from '@nestjs/common';
import { GetPurchaseRequestsHandler } from './get-purchase-requests/get-purchase-requests.handler';
import { GetPurchaseRequestByIdHandler } from './get-purchase-request-by-id/get-purchase-request-by-id.handler';
import { GetPurchaseOrdersHandler } from './get-purchase-orders/get-purchase-orders.handler';
import { GetPurchaseOrderByIdHandler } from './get-purchase-order-by-id/get-purchase-order-by-id.handler';
import { GetPurchaseOrderMatchSummaryHandler } from './get-purchase-order-match-summary/get-purchase-order-match-summary.handler';
import { GetGoodsReceivedNotInvoicedHandler } from './get-goods-received-not-invoiced/get-goods-received-not-invoiced.handler';
import { PurchasingInfrastructureModule } from '@modules/supply/purchasing/infrastructure/infrastructure.module';

export const PURCHASING_QUERY_HANDLERS = [
  GetPurchaseRequestsHandler,
  GetPurchaseRequestByIdHandler,
  GetPurchaseOrdersHandler,
  GetPurchaseOrderByIdHandler,
  GetPurchaseOrderMatchSummaryHandler,
  GetGoodsReceivedNotInvoicedHandler,
];

@Module({
  imports: [PurchasingInfrastructureModule],
  providers: PURCHASING_QUERY_HANDLERS,
})
export class PurchasingQueryModule {}
