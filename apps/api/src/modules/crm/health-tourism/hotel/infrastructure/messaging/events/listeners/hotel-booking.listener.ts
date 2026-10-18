import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import {
  HotelBookingCancelledEvent,
  HotelBookingCreatedEvent,
} from '@modules/crm/health-tourism/hotel/domain/events';
import { BaseEvent } from '@common/interfaces';
import { OnDomainEvent } from '@common/decorators';

/**
 * Otel rezervasyonu denetim kaydı.
 *
 * Rezervasyon üçüncü taraf (HotelBeds) üzerinde para hareketi doğuran bir
 * işlem; buna rağmen hiçbir denetim izi bırakmıyordu. **Muhasebe kaydı burada
 * atılmaz** — komisyon/aracı kayıtları ödeme onayında (`ConfirmBookingPayment`)
 * postlanıyor; burada ikinci kez postlamak mükerrer kayıt üretirdi.
 */
@Injectable()
export class HotelBookingListener {
  private readonly logger = new Logger(HotelBookingListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(HotelBookingCreatedEvent.NAME)
  async handleCreated(event: HotelBookingCreatedEvent): Promise<void> {
    await this.writeAuditLog(event);
  }

  @OnDomainEvent(HotelBookingCancelledEvent.NAME)
  async handleCancelled(event: HotelBookingCancelledEvent): Promise<void> {
    await this.writeAuditLog(event);
  }

  private async writeAuditLog(event: BaseEvent): Promise<void> {
    const { log, metadata } = event;
    if (!log) return;

    try {
      const { action, details, source, actorId, type } = log;
      const logInput = {
        action,
        source,
        details,
        metadata: {
          eventId: metadata.eventId,
          correlationId: metadata.correlationId,
        },
        actorId,
      };

      if (type === LogType.SECURITY) {
        await this.auditLogService.security(logInput);
      } else {
        await this.auditLogService.info(logInput);
      }
    } catch (err) {
      // Denetim kaydı hatası rezervasyon akışını düşürmez.
      this.logger.error('Otel rezervasyonu audit log hatası', err);
    }
  }
}
