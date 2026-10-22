import type { QueryResponse } from '@shared/common/response/response.interface';
import type { EDocumentIntegrationView } from '@modules/finance/e-document/domain/contracts/e-document.contracts';

export type GetEDocumentIntegrationResponse =
  QueryResponse<EDocumentIntegrationView | null>;
