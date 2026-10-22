import { Injectable } from '@nestjs/common';
import { BaseRepository } from '@src/infrastructure/persistence/prisma/base.repository';
import { PrismaService } from '@src/infrastructure/persistence/prisma/prisma.service';
import type {
  EDocumentIntegrationScope,
  EDocumentIntegrationConfigData,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';
import { EDocumentIntegrationConfig } from '@modules/finance/e-document/domain/entities/e-document-integration-config.entity';
import type { IEDocumentIntegrationConfigCommandRepository } from '@modules/finance/e-document/domain/repositories/e-document-integration-config.repository';

@Injectable()
export class EDocumentIntegrationConfigCommandRepository
  extends BaseRepository
  implements IEDocumentIntegrationConfigCommandRepository
{
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async findByScope(
    scope: EDocumentIntegrationScope,
    sourceId: string
  ): Promise<EDocumentIntegrationConfig | null> {
    const raw = await this.db.eDocumentIntegrationConfig.findFirst({
      where:
        scope === 'CLINIC'
          ? { scope, clinicId: sourceId }
          : { scope, organizationId: sourceId },
    });
    return raw
      ? new EDocumentIntegrationConfig(raw as EDocumentIntegrationConfigData)
      : null;
  }

  async findEffectiveByClinicId(
    clinicId: string
  ): Promise<EDocumentIntegrationConfig | null> {
    const clinicConfig = await this.db.eDocumentIntegrationConfig.findFirst({
      where: { clinicId, scope: 'CLINIC', isActive: true },
    });
    if (clinicConfig) {
      return new EDocumentIntegrationConfig(
        clinicConfig as EDocumentIntegrationConfigData
      );
    }

    const organizationConfig =
      await this.db.eDocumentIntegrationConfig.findFirst({
        where: {
          scope: 'ORGANIZATION',
          isActive: true,
          organization: { clinics: { some: { id: clinicId } } },
        },
      });
    return organizationConfig
      ? new EDocumentIntegrationConfig(
          organizationConfig as EDocumentIntegrationConfigData
        )
      : null;
  }

  async upsert(config: EDocumentIntegrationConfig): Promise<void> {
    const data = config.toPersistence();
    const scopeWhere =
      data.scope === 'CLINIC'
        ? { clinicId: data.clinicId! }
        : { organizationId: data.organizationId! };

    await this.db.eDocumentIntegrationConfig.upsert({
      where: scopeWhere,
      create: data,
      update: {
        provider: data.provider,
        environment: data.environment,
        credentialsCiphertext: data.credentialsCiphertext,
        credentialHint: data.credentialHint,
        isActive: data.isActive,
        lastTestedAt: data.lastTestedAt,
        lastTestSucceeded: data.lastTestSucceeded,
      },
    });
  }

  async deleteByScope(
    scope: EDocumentIntegrationScope,
    sourceId: string
  ): Promise<boolean> {
    const result = await this.db.eDocumentIntegrationConfig.deleteMany({
      where:
        scope === 'CLINIC'
          ? { scope, clinicId: sourceId }
          : { scope, organizationId: sourceId },
    });
    return result.count > 0;
  }
}
