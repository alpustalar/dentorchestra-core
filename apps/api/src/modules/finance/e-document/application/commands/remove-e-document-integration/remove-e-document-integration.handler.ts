import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogAction } from '@src/domain/constants/log-action.constant';
import {
  E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
  IEDocumentIntegrationConfigCommandRepository,
} from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import { EDocumentIntegrationConfigNotFoundException } from '@modules/finance/e-document/domain/exceptions/e-document.exceptions';
import { EDocumentIntegrationAccessService } from '../../services/e-document-integration-access.service';
import { RemoveEDocumentIntegrationCommand } from './remove-e-document-integration.command';

@CommandHandler(RemoveEDocumentIntegrationCommand)
export class RemoveEDocumentIntegrationHandler implements ICommandHandler<
  RemoveEDocumentIntegrationCommand,
  void
> {
  constructor(
    @Inject(E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY)
    private readonly repo: IEDocumentIntegrationConfigCommandRepository,
    private readonly access: EDocumentIntegrationAccessService,
    private readonly audit: AuditLogService
  ) {}

  async execute(command: RemoveEDocumentIntegrationCommand): Promise<void> {
    const { scope, sourceId, ctx } = command.payload;
    this.access.assertCanManage(scope, sourceId, ctx);
    const deleted = await this.repo.deleteByScope(scope, sourceId);
    if (!deleted) throw new EDocumentIntegrationConfigNotFoundException();

    await this.audit.security({
      action: LogAction.EDOCUMENT_INTEGRATION_REMOVED,
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
      details: { scope, sourceId },
    });
  }
}
