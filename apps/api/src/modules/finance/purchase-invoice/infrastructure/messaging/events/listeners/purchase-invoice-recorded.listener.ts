import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { PurchaseInvoiceRecordedEvent } from '@modules/finance/purchase-invoice/domain/events';
import { OnDomainEvent } from '@common/decorators';

/**
 * Alış faturası kaydının denetim izi. Kayıt, klinik adına borç (320) ve gider
 * yazdığı için yüksek etkili bir finansal işlemdir: "kim, ne zaman, hangi
 * tedarikçinin hangi belgesini, ne tutarla girdi" burada yanıtlanır.
 */
@Injectable()
export class PurchaseInvoiceRecordedListener {
  private readonly logger = new Logger(PurchaseInvoiceRecordedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(PurchaseInvoiceRecordedEvent.NAME)
  async handle(event: PurchaseInvoiceRecordedEvent): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;
      const { action, source, actorId, type } = log;

      const logInput = {
        action,
        source,
        actorId,
        details: {
          purchaseInvoiceId: event.purchaseInvoiceId,
          clinicId: event.clinicId,
          organizationId: event.organizationId,
          supplierId: event.supplierId,
          invoiceNumber: event.invoiceNumber,
          grandTotal: event.grandTotal,
          currency: event.currency,
        },
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      };

      if (type === LogType.SECURITY) {
        await this.auditLogService.security(logInput);
        return;
      }
      await this.auditLogService.info(logInput);
    } catch (err) {
      this.logger.error('Alış faturası audit log hatası', err);
    }
  }
}
