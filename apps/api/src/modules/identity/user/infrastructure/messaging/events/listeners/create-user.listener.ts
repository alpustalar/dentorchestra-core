import { Injectable, Logger } from '@nestjs/common';
import { CreateUserEvent } from '@modules/identity/user/domain/events/create-user.event';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class CreateUserListener {
  private readonly logger = new Logger(CreateUserListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(CreateUserEvent.NAME)
  async handle(event: CreateUserEvent) {
    const {
      log,
      metadata: { eventId, correlationId },
    } = event;

    try {
      if (log) {
        const {
          details,
          source,
          metadata: logMetadata,
          type,
          actorId,
          action,
        } = log;

        if (type === LogType.SECURITY) {
          await this.auditLogService.security({
            action,
            source,
            actorId,
            details,
            metadata: {
              correlationId,
              eventId,
              ...logMetadata,
            },
          });
        }
      }
    } catch (e) {
      this.logger.error(
        `Audit Log Failure: correlationId: ${correlationId}, eventId: ${eventId}`,
        e.stack
      );
    }
  }
}
