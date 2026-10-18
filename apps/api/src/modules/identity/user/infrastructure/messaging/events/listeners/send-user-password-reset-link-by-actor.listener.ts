import { Injectable, Logger } from '@nestjs/common';
import { SendUserPasswordResetLinkByActorEvent } from '@modules/identity/user/domain/events/send-user-password-reset-link-by-actor.event';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class SendUserPasswordResetLinkByActorListener {
  private readonly logger = new Logger(
    SendUserPasswordResetLinkByActorListener.name
  );

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(SendUserPasswordResetLinkByActorEvent.NAME)
  async handle(event: SendUserPasswordResetLinkByActorEvent) {
    const { log, metadata } = event;

    try {
      if (log) {
        const {
          actorId,
          source,
          details,
          type,
          metadata: logMetadata,
          action,
        } = log;
        if (type === LogType.SECURITY) {
          await this.auditLogService.security({
            action,
            source,
            actorId,
            details,
            metadata: {
              ...metadata,
              ...logMetadata,
            },
          });
        }
      }
    } catch (e) {
      this.logger.error(e);
      this.logger.error(
        `Audit Log Failure: correlationId: ${metadata.correlationId}, eventId: ${metadata.eventId}}`
      );
    }
  }
}
