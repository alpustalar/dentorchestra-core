import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { PurchaseInvoiceCancelledEvent } from '@modules/finance/purchase-invoice/domain/events';
import { OnDomainEvent } from '@common/decorators';

/**
 * Alış faturası iptalinin denetim izi. `SECURITY` seviyesinde loglanır: iptal,
 * defterde storno üreten ve siparişin faturalanmış tutarını düşüren yüksek
 * etkili, elle tetiklenen bir işlemdir (CLAUDE.md finans kuralı 7). Gerekçe ize
 * girer — denetimin sorusu "bu borç neden hükümsüz kılındı"dır.
 */
@Injectable()
export class PurchaseInvoiceCancelledListener {
  private readonly logger = new Logger(PurchaseInvoiceCancelledListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(PurchaseInvoiceCancelledEvent.NAME)
  async handle(event: PurchaseInvoiceCancelledEvent): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;
      const { action, source, actorId } = log;

      await this.auditLogService.security({
        action,
        source,
        actorId,
        details: {
          purchaseInvoiceId: event.purchaseInvoiceId,
          clinicId: event.clinicId,
          organizationId: event.organizationId,
          supplierId: event.supplierId,
          invoiceNumber: event.invoiceNumber,
          purchaseOrderId: event.purchaseOrderId,
          grandTotal: event.grandTotal,
          currency: event.currency,
          reason: event.reason,
        },
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      });
    } catch (err) {
      this.logger.error('Alış faturası iptal audit log hatası', err);
    }
  }
}
