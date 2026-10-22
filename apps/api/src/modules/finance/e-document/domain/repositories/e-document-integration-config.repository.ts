import type { EDocumentIntegrationConfig } from '../entities/e-document-integration-config.entity';
import type {
  EDocumentIntegrationScope,
  EDocumentIntegrationView,
} from '../contracts/e-document.contracts';

export const E_DOCUMENT_INTEGRATION_CONFIG_COMMAND_REPOSITORY = Symbol(
  'IEDocumentIntegrationConfigCommandRepository'
);
export const E_DOCUMENT_INTEGRATION_CONFIG_QUERY_REPOSITORY = Symbol(
  'IEDocumentIntegrationConfigQueryRepository'
);

export interface IEDocumentIntegrationConfigCommandRepository {
  findByScope(
    scope: EDocumentIntegrationScope,
    sourceId: string
  ): Promise<EDocumentIntegrationConfig | null>;
  findEffectiveByClinicId(
    clinicId: string
  ): Promise<EDocumentIntegrationConfig | null>;
  upsert(config: EDocumentIntegrationConfig): Promise<void>;
  deleteByScope(
    scope: EDocumentIntegrationScope,
    sourceId: string
  ): Promise<boolean>;
}

export interface IEDocumentIntegrationConfigQueryRepository {
  findByScope(
    scope: EDocumentIntegrationScope,
    sourceId: string
  ): Promise<EDocumentIntegrationView | null>;
  findEffectiveByClinicId(
    clinicId: string
  ): Promise<EDocumentIntegrationView | null>;
}
