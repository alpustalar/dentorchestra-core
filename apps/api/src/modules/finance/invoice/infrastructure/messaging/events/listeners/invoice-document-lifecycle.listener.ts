import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { InvoiceIssuedEvent } from '@modules/finance/invoice/domain/events/invoice-issued.event';
import { InvoiceFailedEvent } from '@modules/finance/invoice/domain/events/invoice-failed.event';
import { InvoiceCancelledEvent } from '@modules/finance/invoice/domain/events/invoice-cancelled.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Faturanın belge yaşam döngüsünün denetim izi: kesildi (ISSUED), e-belge
 * gönderimi başarısız (FAILED) ve iptal edildi (CANCELLED).
 *
 * Fatura bu sistemde elle kesilmez — iki olay dinleyicisi tetikler, e-belge sonucu
 * finalize eder. Dolayısıyla "bu fatura ne zaman, hangi belge numarasıyla kesildi"
 * sorusunun tek yanıtı audit log'dur; kayıt üzerindeki `issuedAt` damgası ne
 * tetikleyiciyi ne de sonucu taşır.
 */
@Injectable()
export class InvoiceDocumentLifecycleListener {
  private readonly logger = new Logger(InvoiceDocumentLifecycleListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(InvoiceIssuedEvent.NAME)
  async handleIssued(event: InvoiceIssuedEvent): Promise<void> {
    await this.write(event, {
      invoiceId: event.invoiceId,
      clinicId: event.clinicId,
      organizationId: event.organizationId,
      patientId: event.patientId,
      appointmentId: event.appointmentId,
      paymentId: event.paymentId,
      invoiceNumber: event.invoiceNumber,
    });
  }

  @OnDomainEvent(InvoiceFailedEvent.NAME)
  async handleFailed(event: InvoiceFailedEvent): Promise<void> {
    await this.write(event, {
      invoiceId: event.invoiceId,
      clinicId: event.clinicId,
      organizationId: event.organizationId,
      patientId: event.patientId,
      appointmentId: event.appointmentId,
      paymentId: event.paymentId,
      reason: event.reason,
    });
  }

  /**
   * İptal `SECURITY` seviyesinde loglanır: yüksek etkili, elle tetiklenen ve
   * defterde storno üreten bir işlemdir (CLAUDE.md finans kuralı 7). Gerekçe de
   * ize girer — denetimde sorulan soru "neden iptal edildi"dir.
   */
  @OnDomainEvent(InvoiceCancelledEvent.NAME)
  async handleCancelled(event: InvoiceCancelledEvent): Promise<void> {
    await this.write(event, {
      invoiceId: event.invoiceId,
      clinicId: event.clinicId,
      organizationId: event.organizationId,
      patientId: event.patientId,
      appointmentId: event.appointmentId,
      paymentId: event.paymentId,
      invoiceNumber: event.invoiceNumber,
      einvoiceUuid: event.einvoiceUuid,
      grandTotal: event.grandTotal,
      currency: event.currency,
      reason: event.reason,
    });
  }

  private async write(
    event: InvoiceIssuedEvent | InvoiceFailedEvent | InvoiceCancelledEvent,
    details: Record<string, unknown>
  ): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;
      const { action, source, actorId, type } = log;

      const logInput = {
        action,
        source,
        actorId,
        details,
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      };

      if (type === LogType.ERROR) {
        await this.auditLogService.error(logInput);
        return;
      }
      if (type === LogType.SECURITY) {
        await this.auditLogService.security(logInput);
        return;
      }
      await this.auditLogService.info(logInput);
    } catch (err) {
      this.logger.error('Fatura belge audit log hatası', err);
    }
  }
}
