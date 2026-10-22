import { QueryResponse } from '@shared/common/response/response.interface';
import { Party } from '@shared';

export type FindPartiesByIdsResponse = QueryResponse<Party[]>;
