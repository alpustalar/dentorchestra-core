import { Injectable, Logger } from '@nestjs/common';
import { MetaLeadReceivedEvent } from '@modules/crm/meta-ads/domain/events';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class MetaLeadReceivedListener {
  private readonly logger = new Logger(MetaLeadReceivedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(MetaLeadReceivedEvent.NAME)
  async handle(event: MetaLeadReceivedEvent): Promise<void> {
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
      this.logger.error('Meta lead alındı audit log hatası', err);
    }
  }
}
