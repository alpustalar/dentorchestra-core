import { Injectable } from '@nestjs/common';
import { OnDomainEvent } from '@common/decorators';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import {
  BookingPaymentRefundResolvedEvent,
  BookingPaymentRefundRetriedEvent,
} from '@modules/crm/health-tourism/booking-payment/domain/events/booking-payment-refund.events';
import { BaseEvent } from '@common/interfaces';

/**
 * İadenin elle çözümü / yeniden denemesi para kararıdır (kural 7): kim / ne zaman / neye
 * dayanarak hem satırda (kalıcı damga) hem denetim izinde durur.
 *
 * Hatayı YUTMAZ (kural 13): iki event de `outboxRun` ile mühürlenir; audit yazımı düşerse
 * outbox işçisi yeniden dener ve sınırda ölü mektuba düşürür — iz sessizce kaybolmaz.
 */
@Injectable()
export class BookingPaymentRefundAuditListener {
  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(BookingPaymentRefundResolvedEvent.NAME)
  async handleResolved(
    event: BookingPaymentRefundResolvedEvent
  ): Promise<void> {
    await this.write(event);
  }

  @OnDomainEvent(BookingPaymentRefundRetriedEvent.NAME)
  async handleRetried(event: BookingPaymentRefundRetriedEvent): Promise<void> {
    await this.write(event);
  }

  private async write(event: BaseEvent): Promise<void> {
    const { log, metadata } = event;
    if (!log) return;

    await this.auditLogService.record({
      ...log,
      metadata: {
        ...log.metadata,
        eventId: metadata.eventId,
        correlationId: metadata.correlationId,
      },
    });
  }
}
