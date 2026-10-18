import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCashSessionsQuery } from './get-cash-sessions.query';
import { GetCashSessionsResponse } from './get-cash-sessions.response';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  CASH_SESSION_QUERY_REPOSITORY,
  ICashSessionQueryRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.query.repository';

@QueryHandler(GetCashSessionsQuery)
export class GetCashSessionsHandler implements IQueryHandler<
  GetCashSessionsQuery,
  GetCashSessionsResponse
> {
  constructor(
    @Inject(CASH_SESSION_QUERY_REPOSITORY)
    private readonly cashSessionRepo: ICashSessionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetCashSessionsQuery): Promise<GetCashSessionsResponse> {
    const { filter, pagination, ctx } = query.payload;
    const clinicId = ctx.actor.clinicId ?? '';

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('cash-session.list');

    const result = await this.cashSessionRepo.findByClinic({
      clinicId,
      cashRegisterId: filter.cashRegisterId,
      status: filter.status,
      hasDifference: filter.hasDifference,
      pagination,
    });

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({
          clinicId: clinicId,
        }),
      },
    };
  }
}
