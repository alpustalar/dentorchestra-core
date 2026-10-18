import { Injectable, Logger } from '@nestjs/common';
import { UserUpdatedEvent } from '@modules/identity/user/domain/events/user-updated.event';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogType } from '@src/domain/constants/log-action.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class UpdateUserByStaffListener {
  private readonly logger = new Logger(UpdateUserByStaffListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(UserUpdatedEvent.NAME)
  async handle(event: UserUpdatedEvent) {
    const {
      log,
      metadata: { eventId, correlationId },
    } = event;

    try {
      if (log) {
        const { metadata, source, details, actorId, action, type } = log;

        if (type === LogType.SECURITY) {
          await this.auditLogService.security({
            action,
            source,
            actorId,
            details,
            metadata: {
              ...metadata,
              correlationId,
              eventId,
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `AuditLog yazılamadı, correlationId: ${correlationId}, eventId: ${eventId}`
      );
    }
  }
}
