import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCashRegisterByIdQuery } from './get-cash-register-by-id.query';
import { GetCashRegisterByIdResponse } from './get-cash-register-by-id.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  CASH_REGISTER_QUERY_REPOSITORY,
  ICashRegisterQueryRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-register/cash-register.query.repository';
import { CASH_REGISTER_EVENTS } from '@src/domain/constants/events/cash-register.constant';

@QueryHandler(GetCashRegisterByIdQuery)
export class GetCashRegisterByIdHandler implements IQueryHandler<
  GetCashRegisterByIdQuery,
  GetCashRegisterByIdResponse
> {
  constructor(
    @Inject(CASH_REGISTER_QUERY_REPOSITORY)
    private readonly cashRegisterRepo: ICashRegisterQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetCashRegisterByIdQuery
  ): Promise<GetCashRegisterByIdResponse> {
    const { registerId, ctx } = query;
    const data = await this.cashRegisterRepo.findById(registerId);

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
      .orThrow(CASH_REGISTER_EVENTS.DETAIL);

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
