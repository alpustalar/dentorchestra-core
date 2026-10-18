import { Injectable, Logger } from '@nestjs/common';
import { AdminRequestCreatedEvent } from '@modules/platform/admin-request/domain/events/admin-request-created.event';
import { ADMIN_REQUEST_EVENTS } from '@src/domain/constants/events/admin-request.constant';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class AdminRequestCreatedListener {
  private readonly logger = new Logger(AdminRequestCreatedListener.name);

  @OnDomainEvent(ADMIN_REQUEST_EVENTS.CREATED)
  async handle(event: AdminRequestCreatedEvent) {
    try {
      this.logger.log(
        `Admin request created: type=${event.type} targetId=${event.targetId} requestedBy=${event.requestedBy}`
      );
      // TODO: admin'e mail/slack bildirimi eklenebilir
    } catch (e) {
      // eslint-disable-next-line
      this.logger.error(JSON.stringify(e.message));
    }
  }
}
