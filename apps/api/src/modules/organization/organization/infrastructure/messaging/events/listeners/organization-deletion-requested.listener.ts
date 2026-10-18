import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IMailService,
  MAIL_SERVICE,
} from '@src/infrastructure/mail/interfaces/mail.service.interface';
import { OrganizationDeletionRequestedEvent } from '@modules/organization/organization/domain/events';
import { OnDomainEvent } from '@common/decorators';

@Injectable()
export class OrganizationDeletionRequestedListener {
  private readonly logger = new Logger(
    OrganizationDeletionRequestedListener.name
  );

  constructor(
    @Inject(MAIL_SERVICE)
    private readonly mailService: IMailService
  ) {}

  @OnDomainEvent(OrganizationDeletionRequestedEvent.NAME)
  async handle(event: OrganizationDeletionRequestedEvent) {
    const { organizationId, actorEmail, adminRequestId } = event;
    try {
      await this.mailService.sendOrganizationDeletionRequestMail(actorEmail);
      this.logger.log('Organization deletion request mail sent', {
        organizationId,
        adminRequestId,
        actorEmail,
      });
    } catch (e) {
      this.logger.error('Failed to send organization deletion request mail', {
        organizationId,
        adminRequestId,
        error: JSON.stringify(e),
      });
    }
  }
}
