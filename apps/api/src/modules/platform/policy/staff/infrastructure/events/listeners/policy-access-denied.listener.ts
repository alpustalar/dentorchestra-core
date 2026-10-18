import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { PolicyAccessDeniedEvent } from '@modules/platform/policy/staff/domain/events/policy-access-denied.event';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class PolicyAccessDeniedListener {
  private readonly logger = new Logger(PolicyAccessDeniedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(PolicyAccessDeniedEvent.NAME)
  async handle(event: PolicyAccessDeniedEvent): Promise<void> {
    const {
      log,
      metadata: { eventId, correlationId },
    } = event;

    if (!log) return;

    try {
      await this.auditLogService.security({
        action: log.action,
        source: log.source,
        actorId: log.actorId,
        details: log.details,
        metadata: { eventId, correlationId },
      });
    } catch (error) {
      this.logger.error('PolicyAccessDenied audit log failed', error);
    }
  }
}
