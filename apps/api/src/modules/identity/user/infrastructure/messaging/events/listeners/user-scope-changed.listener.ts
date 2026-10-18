import { Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { BaseEvent } from '@common/interfaces';
import {
  UserManagedClinicsAssignedEvent,
  UserOrganizationOwnershipGrantedEvent,
} from '@modules/identity/user/domain/events/user-scope-changed.event';
import { OnDomainEvent } from '@common/decorators';

/**
 * Kapsam devirlerini güvenlik denetim kanalına yazar. Bu kayıtlar sıradan
 * `USER_UPDATE` logları arasında kaybolmamalı: "kim, kime, hangi kliniğin
 * yönetimini verdi" sorusu bir olay sonrası ilk sorulan sorudur.
 *
 * Denetim yazımı işlemin kendisini geriye almaz — hata yalnız loglanır; yetki
 * zaten yazılmıştır, burada patlamak kullanıcıya yanlış bir başarısızlık
 * bildirmek olurdu.
 */
@Injectable()
export class UserScopeChangedListener {
  private readonly logger = new Logger(UserScopeChangedListener.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @OnDomainEvent(UserManagedClinicsAssignedEvent.NAME)
  async handleManagedClinics(
    event: UserManagedClinicsAssignedEvent
  ): Promise<void> {
    await this.write(event);
  }

  @OnDomainEvent(UserOrganizationOwnershipGrantedEvent.NAME)
  async handleOrganizationOwnership(
    event: UserOrganizationOwnershipGrantedEvent
  ): Promise<void> {
    await this.write(event);
  }

  private async write(event: BaseEvent): Promise<void> {
    const {
      log,
      metadata: { eventId, correlationId },
    } = event;

    if (!log) return;

    try {
      const { action, source, actorId, details, metadata } = log;

      await this.auditLogService.security({
        action,
        source,
        actorId,
        details,
        metadata: { ...metadata, correlationId, eventId },
      });
    } catch {
      this.logger.error(
        `Kapsam devri denetim kaydı yazılamadı, correlationId: ${correlationId}, eventId: ${eventId}`
      );
    }
  }
}
