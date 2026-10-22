import type {
  EDocumentEnvironment,
  EDocumentProvider,
} from '@modules/finance/e-document/domain/contracts/e-document.contracts';

export interface TestEDocumentIntegrationResponse {
  success: true;
  provider: EDocumentProvider;
  environment: EDocumentEnvironment;
  companyTitle: string | null;
  taxNumber: string | null;
}
