import { Pagination, Party } from '@shared';
import { FindPartiesFilter } from '@modules/finance/party/domain/contracts/party';

export const PARTY_QUERY_REPOSITORY = Symbol('IPartyQueryRepository');

export interface IPartyQueryRepository {
  findById(id: string): Promise<Party | null>;
  findByIds(clinicId: string, ids: string[]): Promise<Party[]>;
  findMany(
    filter: FindPartiesFilter,
    pagination: Pagination
  ): Promise<{ items: Party[]; total: number }>;
}
