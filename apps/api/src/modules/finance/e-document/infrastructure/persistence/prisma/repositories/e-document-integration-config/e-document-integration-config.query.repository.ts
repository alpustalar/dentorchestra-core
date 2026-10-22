import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import type {
  EDocumentIntegrationView,
  EDocumentIntegrationConfigData,
  EDocumentIntegrationScope,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import type { IEDocumentIntegrationConfigQueryRepository } from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';

@Injectable()
export class EDocumentIntegrationConfigQueryRepository
  extends BaseRepository
  implements IEDocumentIntegrationConfigQueryRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByScope(
    scope: EDocumentIntegrationScope,
    sourceId: string
  ): Promise<EDocumentIntegrationView | null> {
    const config = await this.db.eDocumentIntegrationConfig.findFirst({
      where:
        scope === 'CLINIC'
          ? { scope, clinicId: sourceId, isActive: true }
          : { scope, organizationId: sourceId, isActive: true },
    });
    return config ? this.toView(config, false, sourceId) : null;
  }

  async findEffectiveByClinicId(
    clinicId: string
  ): Promise<EDocumentIntegrationView | null> {
    const direct = await this.db.eDocumentIntegrationConfig.findFirst({
      where: { clinicId, scope: 'CLINIC', isActive: true },
    });
    if (direct) return this.toView(direct, false, clinicId);

    const inherited = await this.db.eDocumentIntegrationConfig.findFirst({
      where: {
        scope: 'ORGANIZATION',
        isActive: true,
        organization: { clinics: { some: { id: clinicId } } },
      },
    });
    return inherited && inherited.organizationId
      ? this.toView(inherited, true, inherited.organizationId)
      : null;
  }

  private toView(
    data: EDocumentIntegrationConfigData,
    inherited: boolean,
    sourceId: string
  ): EDocumentIntegrationView {
    return {
      id: data.id,
      scope: data.scope,
      provider: data.provider,
      environment: data.environment,
      configured: true,
      credentialHint: data.credentialHint,
      inherited,
      sourceId,
      lastTestedAt: data.lastTestedAt,
      lastTestSucceeded: data.lastTestSucceeded,
      updatedAt: data.updatedAt,
    };
  }
}
