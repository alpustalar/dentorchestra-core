import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindPartiesByIdsQuery } from './find-parties-by-ids.query';
import { FindPartiesByIdsResponse } from './find-parties-by-ids.response';
import {
  IPartyQueryRepository,
  PARTY_QUERY_REPOSITORY,
} from '@modules/finance/party/domain/repositories/party/party.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

/**
 * Çoğul cari çözümlemesi — başka bir modülün sahip olduğu kayıtları (bordro
 * tahakkuku gibi) partyId listesinden isim/kimlik için tek roundtrip'te
 * zenginleştirir. Tek tek `GetPartyByIdQuery` dispatch'i N+1'e düşerdi.
 */
@QueryHandler(FindPartiesByIdsQuery)
export class FindPartiesByIdsHandler implements IQueryHandler<
  FindPartiesByIdsQuery,
  FindPartiesByIdsResponse
> {
  constructor(
    @Inject(PARTY_QUERY_REPOSITORY)
    private readonly partyRepo: IPartyQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindPartiesByIdsQuery
  ): Promise<FindPartiesByIdsResponse> {
    const { clinicId, ids, ctx } = query.payload;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('party.find-by-ids');

    const parties = await this.partyRepo.findByIds(clinicId, [...ids]);

    return {
      data: parties,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
