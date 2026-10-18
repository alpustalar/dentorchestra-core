import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetPartyByIdQuery } from './get-party-by-id.query';
import { GetPartyByIdResponse } from './get-party-by-id.response';
import {
  IPartyQueryRepository,
  PARTY_QUERY_REPOSITORY,
} from '@modules/finance/party/domain/repositories/party/party.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(GetPartyByIdQuery)
export class GetPartyByIdHandler implements IQueryHandler<
  GetPartyByIdQuery,
  GetPartyByIdResponse
> {
  constructor(
    @Inject(PARTY_QUERY_REPOSITORY)
    private readonly partyRepo: IPartyQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetPartyByIdQuery): Promise<GetPartyByIdResponse> {
    const { partyId, ctx } = query;

    const party = await this.partyRepo.findById(partyId);

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    // Cari taraf organizasyona aittir — id tahmini kapıda durdurulur.
    evaluator
      .check(
        (p) => !party || p.canAccessClinicFinances(party.clinicId),
        'Bu cari tarafa erişim yetkiniz yok.'
      )
      .orThrow('party.detail');

    return {
      data: party,
      meta: {
        // Alan görünürlüğü de yetkiyle aynı eksende (şube): org seviyesinde
        // çözmek, kardeş şubenin carisini açan bir aktöre org tier'ı veriyordu.
        serializationOptions: policy.getSerializationOptions({
          clinicId: party?.clinicId ?? '',
        }),
      },
    };
  }
}
