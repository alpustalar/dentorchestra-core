import { Injectable, Logger } from '@nestjs/common';
import { POS_EVENTS } from '@src/domain/constants/events';
import { PosTransactionSucceededEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-succeeded.event';
import { PosTransactionFailedEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-failed.event';
import { PosTransactionCancelledEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-cancelled.event';
import { PosTransactionTimeoutEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-timeout.event';
import { PosTransactionReversedEvent } from '@modules/finance/pos/physical/domain/events/pos-transaction-reversed.event';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class PosTransactionListener {
  private readonly logger = new Logger(PosTransactionListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(POS_EVENTS.TRANSACTION_SUCCESS)
  handleSuccess(event: PosTransactionSucceededEvent): void {
    this.logger.log(
      `POS işlem başarılı: id=${event.posTransactionId} clinicId=${event.clinicId} amount=${event.amount.toString()} ${event.currency} externalRef=${event.externalRef}`
    );
  }

  @OnDomainEvent(POS_EVENTS.TRANSACTION_FAILED)
  handleFailed(event: PosTransactionFailedEvent): void {
    this.logger.warn(
      `POS işlem başarısız: id=${event.posTransactionId} clinicId=${event.clinicId}`
    );
  }

  @OnDomainEvent(POS_EVENTS.TRANSACTION_CANCELLED)
  handleCancelled(event: PosTransactionCancelledEvent): void {
    this.logger.warn(
      `POS işlem iptal edildi: id=${event.posTransactionId} clinicId=${event.clinicId}`
    );
  }

  @OnDomainEvent(POS_EVENTS.TRANSACTION_TIMEOUT)
  handleTimeout(event: PosTransactionTimeoutEvent): void {
    this.logger.warn(
      `POS işlem zaman aşımı: id=${event.posTransactionId} clinicId=${event.clinicId}`
    );
  }

  /**
   * Kart iptali / iadesi kalıcı denetim izine yazılır.
   *
   * Yukarıdaki dört dinleyici yalnız uygulama log'una basar (operasyonel
   * teşhis); log'lar rotasyona tabidir ve bir itiraz incelemesinde kaynak
   * olamaz. İptal/iade ise parayı geri götüren bir karardır: kim yaptığı
   * `audit_logs`'ta durmak zorundadır.
   */
  @OnDomainEvent(PosTransactionReversedEvent.NAME)
  async handleReversed(event: PosTransactionReversedEvent): Promise<void> {
    const { log, metadata } = event;

    try {
      if (!log) return;
      const { action, source, actorId, type, details: note } = log;

      const logInput = {
        action,
        source,
        actorId,
        details: {
          posTransactionId: event.posTransactionId,
          originalPosTransactionId: event.originalPosTransactionId,
          clinicId: event.clinicId,
          kind: event.kind,
          paymentId: event.paymentId,
          externalRef: event.externalRef,
          amount: event.amount,
          currency: event.currency,
          note,
        },
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
      // Audit yazımı ters kaydı geri almaz; yalnız iz kaybını raporlar.
      this.logger.error('POS ters kayıt audit log hatası', err);
    }
  }
}
