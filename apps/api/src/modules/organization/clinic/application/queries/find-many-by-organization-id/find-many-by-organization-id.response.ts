import { QueryResponse } from '@shared/common/response/response.interface';
import { ClinicDirectoryItem } from '@modules/organization/clinic/domain/contracts/clinic';

export type FindManyByOrganizationIdQueryResponse = QueryResponse<
  ClinicDirectoryItem[]
>;
