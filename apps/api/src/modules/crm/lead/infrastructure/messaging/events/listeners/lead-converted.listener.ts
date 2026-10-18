import { Injectable, Logger } from '@nestjs/common';
import { LeadConvertedEvent } from '@modules/crm/lead/domain/events';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class LeadConvertedListener {
  private readonly logger = new Logger(LeadConvertedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(LeadConvertedEvent.NAME)
  async handle(event: LeadConvertedEvent): Promise<void> {
    const { log, metadata } = event;
    try {
      if (!log) return;
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
      this.logger.error('Lead dönüşüm audit log hatası', err);
    }
  }
}
