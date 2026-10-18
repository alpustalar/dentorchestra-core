import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCashRegistersQuery } from './get-cash-registers.query';
import { GetCashRegistersResponse } from './get-cash-registers.response';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  CASH_REGISTER_QUERY_REPOSITORY,
  ICashRegisterQueryRepository,
} from '@modules/finance/cash-register/domain/repositories/cash-register/cash-register.query.repository';

@QueryHandler(GetCashRegistersQuery)
export class GetCashRegistersHandler implements IQueryHandler<
  GetCashRegistersQuery,
  GetCashRegistersResponse
> {
  constructor(
    @Inject(CASH_REGISTER_QUERY_REPOSITORY)
    private readonly cashRegisterRepo: ICashRegisterQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetCashRegistersQuery
  ): Promise<GetCashRegistersResponse> {
    const { filter, pagination, ctx } = query.payload;
    const clinicId = ctx.actor.clinicId ?? '';

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('cash-register.list');

    const result = await this.cashRegisterRepo.findByClinic({
      clinicId,
      status: filter.status,
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
