import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { PaymentPaidEvent } from '@modules/finance/payment/domain/events/payment-paid.event';
import { PaymentRefundedEvent } from '@modules/finance/payment/domain/events/payment-refunded.event';
import { PaymentFailedEvent } from '@modules/finance/payment/domain/events/payment-failed.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Para hareketlerinin denetim izi: tahsilat, iade ve başarısız tahsilat denemesi.
 *
 * Bu olaylar `IAuditLog` alanlarını (action/source/actorId/details) baştan beri
 * taşıyordu ama **hiçbir dinleyici** audit log'a yazmıyordu: para tahsil
 * edilirken ve — daha kötüsü — **iade edilirken** "kim, ne zaman, hangi kanaldan"
 * sorusunun kalıcı bir yanıtı yoktu. Taksit satırındaki `paidAt` damgası ne
 * aktörü ne kanalı taşır; iade için kayıtta damga bile yok.
 */
@Injectable()
export class PaymentLifecycleListener {
  private readonly logger = new Logger(PaymentLifecycleListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(PaymentPaidEvent.NAME)
  async handlePaid(event: PaymentPaidEvent): Promise<void> {
    await this.write(event, {
      paymentId: event.paymentId,
      installmentId: event.installmentId,
      clinicId: event.clinicId,
      appointmentId: event.appointmentId,
    });
  }

  @OnDomainEvent(PaymentRefundedEvent.NAME)
  async handleRefunded(event: PaymentRefundedEvent): Promise<void> {
    await this.write(event, {
      paymentId: event.paymentId,
      installmentId: event.installmentId,
      clinicId: event.clinicId,
      appointmentId: event.appointmentId,
    });
  }

  @OnDomainEvent(PaymentFailedEvent.NAME)
  async handleFailed(event: PaymentFailedEvent): Promise<void> {
    await this.write(event, {
      paymentId: event.paymentId,
      installmentId: event.installmentId,
      clinicId: event.clinicId,
      appointmentId: event.appointmentId,
    });
  }

  private async write(
    event: PaymentPaidEvent | PaymentRefundedEvent | PaymentFailedEvent,
    details: Record<string, unknown>
  ): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;
      const { action, source, actorId, type, details: note } = log;

      const logInput = {
        action,
        source,
        actorId,
        details: { ...details, note },
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
      };

      if (type === LogType.ERROR) {
        await this.auditLogService.error(logInput);
        return;
      }
      await this.auditLogService.info(logInput);
    } catch (err) {
      // Audit yazımı para hareketini geri almaz; yalnız iz kaybını raporlar.
      this.logger.error('Ödeme audit log hatası', err);
    }
  }
}
