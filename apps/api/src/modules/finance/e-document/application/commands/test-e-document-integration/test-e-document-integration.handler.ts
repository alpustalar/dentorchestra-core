import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogAction } from '@src/domain/constants/log-action.constant';
import {
  E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
  IEDocumentIntegrationConfigCommandRepository,
} from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import { NilveraEInvoiceAdapter } from '@modules/finance/e-document/infrastructure/adapters/nilvera/nilvera-e-invoice.adapter';
import { ResolveEDocumentIntegrationService } from '../../services/resolve-e-document-integration.service';
import { EDocumentIntegrationAccessService } from '../../services/e-document-integration-access.service';
import { TestEDocumentIntegrationCommand } from './test-e-document-integration.command';
import type { TestEDocumentIntegrationResponse } from './test-e-document-integration.response';

@CommandHandler(TestEDocumentIntegrationCommand)
export class TestEDocumentIntegrationHandler implements ICommandHandler<
  TestEDocumentIntegrationCommand,
  TestEDocumentIntegrationResponse
> {
  constructor(
    @Inject(E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY)
    private readonly repo: IEDocumentIntegrationConfigCommandRepository,
    private readonly resolver: ResolveEDocumentIntegrationService,
    private readonly nilvera: NilveraEInvoiceAdapter,
    private readonly access: EDocumentIntegrationAccessService,
    private readonly audit: AuditLogService
  ) {}

  async execute(
    command: TestEDocumentIntegrationCommand
  ): Promise<TestEDocumentIntegrationResponse> {
    const { scope, sourceId, ctx } = command.payload;
    this.access.assertCanManage(scope, sourceId, ctx);
    const integration = await this.resolver.resolveByScope(scope, sourceId);

    let company: { companyTitle: string | null; taxNumber: string | null };
    try {
      company = await this.nilvera.testConnection(integration);
      await this.recordResult(scope, sourceId, true);
    } catch (error) {
      await this.recordResult(scope, sourceId, false);
      await this.audit.security({
        action: LogAction.EDOCUMENT_INTEGRATION_TESTED,
        actorId: ctx.actor.userId,
        source: ctx.actor.source,
        details: {
          scope,
          sourceId,
          provider: integration.provider,
          success: false,
        },
      });
      throw error;
    }

    await this.audit.security({
      action: LogAction.EDOCUMENT_INTEGRATION_TESTED,
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
      details: {
        scope,
        sourceId,
        provider: integration.provider,
        success: true,
        remoteTaxNumber: company.taxNumber,
      },
    });

    return {
      success: true,
      provider: integration.provider,
      environment: integration.environment,
      ...company,
    };
  }

  private async recordResult(
    scope: 'CLINIC' | 'ORGANIZATION',
    sourceId: string,
    succeeded: boolean
  ): Promise<void> {
    const config = await this.repo.findByScope(scope, sourceId);
    if (!config) return;
    config.recordConnectionTest(succeeded);
    await this.repo.upsert(config);
  }
}
