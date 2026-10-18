import { Module } from '@nestjs/common';
import { CreatePurchaseRequestHandler } from './create-purchase-request/create-purchase-request.handler';
import { ApprovePurchaseRequestHandler } from './approve-purchase-request/approve-purchase-request.handler';
import { RejectPurchaseRequestHandler } from './reject-purchase-request/reject-purchase-request.handler';
import { CancelPurchaseRequestHandler } from './cancel-purchase-request/cancel-purchase-request.handler';
import { CreatePurchaseOrderHandler } from './create-purchase-order/create-purchase-order.handler';
import { SendPurchaseOrderHandler } from './send-purchase-order/send-purchase-order.handler';
import { ReceivePurchaseOrderHandler } from './receive-purchase-order/receive-purchase-order.handler';
import { CancelPurchaseOrderHandler } from './cancel-purchase-order/cancel-purchase-order.handler';
import { ApplyInvoiceToPurchaseOrderHandler } from './apply-invoice-to-purchase-order/apply-invoice-to-purchase-order.handler';
import { RevertInvoiceFromPurchaseOrderHandler } from './revert-invoice-from-purchase-order/revert-invoice-from-purchase-order.handler';
import { PurchasingInfrastructureModule } from '@modules/supply/purchasing/infrastructure/infrastructure.module';
import { InventoryDomainServicesModule } from '@modules/supply/inventory/domain/services/services.module';

export const PURCHASING_COMMAND_HANDLERS = [
  CreatePurchaseRequestHandler,
  ApprovePurchaseRequestHandler,
  RejectPurchaseRequestHandler,
  CancelPurchaseRequestHandler,
  CreatePurchaseOrderHandler,
  SendPurchaseOrderHandler,
  ReceivePurchaseOrderHandler,
  CancelPurchaseOrderHandler,
  ApplyInvoiceToPurchaseOrderHandler,
  RevertInvoiceFromPurchaseOrderHandler,
];

@Module({
  // Katalog kapısı (tedarikçi/ürün kullanılabilirliği) için **yaprak** domain
  // servis modülü import edilir; `InventoryModule` değil (bkz. CLAUDE.md).
  imports: [PurchasingInfrastructureModule, InventoryDomainServicesModule],
  providers: PURCHASING_COMMAND_HANDLERS,
})
export class PurchasingCommandModule {}
