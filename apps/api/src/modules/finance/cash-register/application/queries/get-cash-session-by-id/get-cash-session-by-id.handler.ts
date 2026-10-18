import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCashSessionByIdQuery } from './get-cash-session-by-id.query';
import { GetCashSessionByIdResponse } from './get-cash-session-by-id.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  CASH_SESSION_QUERY_REPOSITORY,
  ICashSessionQueryRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.query.repository';

@QueryHandler(GetCashSessionByIdQuery)
export class GetCashSessionByIdHandler implements IQueryHandler<
  GetCashSessionByIdQuery,
  GetCashSessionByIdResponse
> {
  constructor(
    @Inject(CASH_SESSION_QUERY_REPOSITORY)
    private readonly cashSessionRepo: ICashSessionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetCashSessionByIdQuery
  ): Promise<GetCashSessionByIdResponse> {
    const { sessionId, ctx } = query;
    const data = await this.cashSessionRepo.findByIdWithMovements(sessionId);

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    if (!data) {
      return {
        data: null,
        meta: {
          serializationOptions: policy.getSerializationOptions({
            clinicId: ctx.actor.clinicId ?? '',
          }),
        },
      };
    }

    evaluator
      .check((p) => p.canAccessClinicFinances(data.clinicId))
      .orThrow('cash-session.detail');

    return {
      data,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: data.clinicId,
        }),
      },
    };
  }
}
