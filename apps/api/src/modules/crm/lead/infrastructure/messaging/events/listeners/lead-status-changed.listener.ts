import { Injectable, Logger } from '@nestjs/common';
import { LeadStatusChangedEvent } from '@modules/crm/lead/domain/events';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class LeadStatusChangedListener {
  private readonly logger = new Logger(LeadStatusChangedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(LeadStatusChangedEvent.NAME)
  async handle(event: LeadStatusChangedEvent): Promise<void> {
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
      this.logger.error('Lead durum değişikliği audit log hatası', err);
    }
  }
}
