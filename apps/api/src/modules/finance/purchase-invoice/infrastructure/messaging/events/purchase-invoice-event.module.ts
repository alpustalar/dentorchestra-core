import { Module } from '@nestjs/common';
import { AuditLogModule } from '@modules/platform/audit-log/audit-log.module';
import { ContextModule } from '@src/infrastructure/context/context.module';
import { PurchaseInvoiceRecordedListener } from './listeners/purchase-invoice-recorded.listener';
import { PurchaseInvoiceCancelledListener } from './listeners/purchase-invoice-cancelled.listener';

/**
 * Alış faturası olaylarının dinleyicisi. Publisher yok: olay **entity içinde**
 * raise edilir (`PurchaseInvoice.create`) ve repository'nin `create`'i başarılı
 * olduğunda `flushEvents()` ile ALS'ye yazılır — kayıt yazılmazsa olay da yayınlanmaz.
 * Aynısı iptal için de geçerli (`PurchaseInvoice.cancel` → `update`).
 */
@Module({
  imports: [AuditLogModule, ContextModule],
  providers: [
    PurchaseInvoiceRecordedListener,
    PurchaseInvoiceCancelledListener,
  ],
})
export class PurchaseInvoiceEventModule {}
