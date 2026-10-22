import { Inject, Injectable } from '@nestjs/common';
import { TokenCipherService } from '@src/infrastructure/security/crypto/token-cipher.service';
import {
  E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY,
  IEDocumentIntegrationConfigCommandRepository,
} from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';
import type { ResolvedEDocumentIntegration } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { EDocumentCredentialsSchema } from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { EDocumentIntegrationNotConfiguredException } from '@modules/finance/e-document/domain/exceptions/e-document.exceptions';
import { EDocumentIntegrationConfig } from '@modules/finance/e-document/domain/entities/e-document-integration-config.entity';

@Injectable()
export class ResolveEDocumentIntegrationService {
  constructor(
    @Inject(E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY)
    private readonly configRepo: IEDocumentIntegrationConfigCommandRepository,
    private readonly cipher: TokenCipherService
  ) {}

  async resolveOptional(
    clinicId: string
  ): Promise<ResolvedEDocumentIntegration | null> {
    const config = await this.configRepo.findEffectiveByClinicId(clinicId);
    if (!config) return null;

    return this.toResolved(config);
  }

  async resolveByScope(
    scope: 'CLINIC' | 'ORGANIZATION',
    sourceId: string
  ): Promise<ResolvedEDocumentIntegration> {
    const config = await this.configRepo.findByScope(scope, sourceId);
    if (!config) {
      throw new EDocumentIntegrationNotConfiguredException(sourceId);
    }
    return this.toResolved(config);
  }

  private toResolved(
    config: EDocumentIntegrationConfig
  ): ResolvedEDocumentIntegration {
    const data = config.toPersistence();
    const credentials = EDocumentCredentialsSchema.parse(
      JSON.parse(this.cipher.decrypt(config.credentialsCiphertext))
    );
    const sourceId = data.clinicId ?? data.organizationId;
    if (!sourceId) {
      throw new Error('E-belge konfigürasyon kapsam kimliği eksik.');
    }

    return {
      configId: config.id,
      scope: config.scope,
      sourceId,
      provider: config.provider,
      environment: config.environment,
      credentials,
    };
  }

  async resolve(clinicId: string): Promise<ResolvedEDocumentIntegration> {
    const integration = await this.resolveOptional(clinicId);
    if (!integration) {
      throw new EDocumentIntegrationNotConfiguredException(clinicId);
    }
    return integration;
  }
}
