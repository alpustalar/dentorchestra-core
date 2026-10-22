import type { EDocumentStatusType as EDocumentStatus } from '@input-type-schemas/EDocumentStatusSchema';
import type { EDocumentTypeType as EDocumentType } from '@input-type-schemas/EDocumentTypeSchema';
import type {
  EDocumentRequest,
  EDocumentResult,
  MailboxInfo,
  ResolvedEDocumentIntegration,
} from '../contracts/e-document.contracts';

export interface EDocumentProviderAdapter {
  issue(
    req: EDocumentRequest,
    integration: ResolvedEDocumentIntegration
  ): Promise<EDocumentResult>;
  cancel(
    input: {
      documentType: EDocumentType;
      uuid: string;
      reason: string;
    },
    integration: ResolvedEDocumentIntegration
  ): Promise<void>;
  getStatus(
    input: { documentType: EDocumentType; uuid: string },
    integration: ResolvedEDocumentIntegration
  ): Promise<EDocumentStatus>;
  checkMailbox(
    taxId: string,
    integration: ResolvedEDocumentIntegration
  ): Promise<MailboxInfo>;
  testConnection(
    integration: ResolvedEDocumentIntegration
  ): Promise<{ companyTitle: string | null; taxNumber: string | null }>;
}
