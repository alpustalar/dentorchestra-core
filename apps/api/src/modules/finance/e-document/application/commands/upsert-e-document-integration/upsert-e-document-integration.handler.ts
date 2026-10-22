import { Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { TokenCipherService } from '@src/infrastructure/security/crypto/token-cipher.service';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';
import { AuditLogService } from '@modules/platform/audit-log/audit-log.service';
import { LogAction } from '@src/domain/constants/log-action.constant';
import {
  E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
  IEDocumentIntegrationConfigCommandRepository,
} from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import { EDocumentIntegrationConfig } from '@modules/finance/e-document/domain/entities/e-document-integration-config.entity';
import { EDocumentIntegrationAccessService } from '../../services/e-document-integration-access.service';
import { UpsertEDocumentIntegrationCommand } from './upsert-e-document-integration.command';

@CommandHandler(UpsertEDocumentIntegrationCommand)
export class UpsertEDocumentIntegrationHandler implements ICommandHandler<
  UpsertEDocumentIntegrationCommand,
  string
> {
  constructor(
    @Inject(E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY)
    private readonly repo: IEDocumentIntegrationConfigCommandRepository,
    private readonly cipher: TokenCipherService,
    private readonly access: EDocumentIntegrationAccessService,
    private readonly txManager: TransactionManager,
    private readonly audit: AuditLogService
  ) {}

  async execute(command: UpsertEDocumentIntegrationCommand): Promise<string> {
    const { scope, sourceId, data, ctx } = command.payload;
    this.access.assertCanManage(scope, sourceId, ctx);

    const encrypted = this.cipher.encrypt(
      JSON.stringify({ provider: data.provider, apiKey: data.apiKey })
    );
    const hint = `****${data.apiKey.slice(-4)}`;

    const id = await this.txManager.run(async () => {
      const existing = await this.repo.findByScope(scope, sourceId);
      if (existing) {
        existing.updateConnection({
          provider: data.provider,
          environment: data.environment,
          credentialsCiphertext: encrypted,
          credentialHint: hint,
        });
        await this.repo.upsert(existing);
        return existing.id;
      }

      const config = EDocumentIntegrationConfig.create({
        scope,
        provider: data.provider,
        environment: data.environment,
        credentialsCiphertext: encrypted,
        credentialHint: hint,
        clinicId: scope === 'CLINIC' ? sourceId : null,
        organizationId: scope === 'ORGANIZATION' ? sourceId : null,
      });
      await this.repo.upsert(config);
      return config.id;
    });

    await this.audit.security({
      action: LogAction.EDOCUMENT_INTEGRATION_CONFIGURED,
      actorId: ctx.actor.userId,
      source: ctx.actor.source,
      details: {
        scope,
        sourceId,
        provider: data.provider,
        environment: data.environment,
        credentialHint: hint,
      },
    });
    return id;
  }
}
