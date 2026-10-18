import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetOpenCashSessionQuery } from './get-open-cash-session.query';
import { GetOpenCashSessionResponse } from './get-open-cash-session.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  CASH_SESSION_QUERY_REPOSITORY,
  ICashSessionQueryRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-session/cash-session.query.repository';

@QueryHandler(GetOpenCashSessionQuery)
export class GetOpenCashSessionHandler implements IQueryHandler<
  GetOpenCashSessionQuery,
  GetOpenCashSessionResponse
> {
  constructor(
    @Inject(CASH_SESSION_QUERY_REPOSITORY)
    private readonly cashSessionRepo: ICashSessionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetOpenCashSessionQuery
  ): Promise<GetOpenCashSessionResponse> {
    const { registerId, ctx } = query;
    const data = await this.cashSessionRepo.findOpenByRegister(registerId);

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
      .orThrow('cash-session.open-detail');

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
