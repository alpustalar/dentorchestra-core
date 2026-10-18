import { Injectable, Logger } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AdminRequestReviewedEvent } from '@modules/platform/admin-request/domain/events/admin-request-reviewed.event';
import { ADMIN_REQUEST_EVENTS } from '@src/domain/constants/events/admin-request.constant';

import { SoftDeleteClinicCommand } from '@modules/organization/clinic/application/commands/soft-delete-clinic/soft-delete-clinic.command';
import { SoftDeleteOrganizationCommand } from '@modules/organization/organization/application/commands/soft-delete-organization/soft-delete-organization.command';
import { ExecutionContextFactory } from '@src/domain/common/execution/execution-context.factory';
import { AdminRequestStatusSchema, AdminRequestTypeSchema } from '@shared';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class AdminRequestReviewedListener {
  private readonly logger = new Logger(AdminRequestReviewedListener.name);
  private readonly internalCtx = ExecutionContextFactory.createInternal();

  constructor(private readonly commandBus: CommandBus) {}

  @OnDomainEvent(ADMIN_REQUEST_EVENTS.REVIEWED)
  async handle(event: AdminRequestReviewedEvent) {
    if (event.status !== AdminRequestStatusSchema.enum.APPROVED) return;

    try {
      switch (event.type) {
        case AdminRequestTypeSchema.enum.CLINIC_DELETION:
          await this.commandBus.execute(
            new SoftDeleteClinicCommand(event.targetId, this.internalCtx)
          );
          break;
        case AdminRequestTypeSchema.enum.ORGANIZATION_DELETION:
          // `internalCtx` sistem kaynaklı: handler bu durumda yeni bir onay
          // talebi açmaz, doğrudan siler (talep zaten onaylandı).
          await this.commandBus.execute(
            new SoftDeleteOrganizationCommand(event.targetId, this.internalCtx)
          );
          break;
      }
    } catch (e) {
      // eslint-disable-next-line
      this.logger.error(JSON.stringify(e.message));
    }
  }
}
