import { QueryResponse } from '@shared/common/response/response.interface';
import type { ClinicEDocumentProfile } from '@modules/organization/clinic/domain/contracts/clinic';

export type GetClinicEDocumentProfileResponse =
  QueryResponse<ClinicEDocumentProfile | null>;
