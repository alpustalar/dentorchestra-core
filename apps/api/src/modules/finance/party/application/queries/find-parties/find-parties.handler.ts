import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { FindPartiesQuery } from './find-parties.query';
import { FindPartiesResponse } from './find-parties.response';
import {
  IPartyQueryRepository,
  PARTY_QUERY_REPOSITORY,
} from '@modules/finance/party/domain/repositories/party/party.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(FindPartiesQuery)
export class FindPartiesHandler implements IQueryHandler<
  FindPartiesQuery,
  FindPartiesResponse
> {
  constructor(
    @Inject(PARTY_QUERY_REPOSITORY)
    private readonly partyRepo: IPartyQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: FindPartiesQuery): Promise<FindPartiesResponse> {
    const { clinicId, pagination, role, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu şubenin cari taraflarına erişim yetkiniz yok.'
      )
      .orThrow('party.list');

    // Süzgeç yetkiyle aynı eksende: kapı şube seviyesinde açıldığı için liste
    // de şube kapsamında döner (org geneli liste org kapısı ister).
    const { items, total } = await this.partyRepo.findMany(
      { clinicId, role },
      pagination
    );

    return {
      data: items,
      meta: {
        pagination: buildPaginationMeta(pagination, total),
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
