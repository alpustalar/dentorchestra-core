import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTaxParametersQuery } from './get-tax-parameters.query';
import { GetTaxParametersResponse } from './get-tax-parameters.response';
import {
  ITaxParameterQueryRepository,
  TAX_PARAMETER_QUERY_REPOSITORY,
} from '@modules/finance/accounting/tax-parameters/domain/repositories/tax-parameter/tax-parameter.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetTaxParametersQuery)
export class GetTaxParametersHandler implements IQueryHandler<
  GetTaxParametersQuery,
  GetTaxParametersResponse
> {
  constructor(
    @Inject(TAX_PARAMETER_QUERY_REPOSITORY)
    private readonly taxParameterRepo: ITaxParameterQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetTaxParametersQuery
  ): Promise<GetTaxParametersResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin vergi parametrelerine erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.TAX_PARAMETERS);

    const items = await this.taxParameterRepo.findAllByClinicId(clinicId);

    return {
      data: items,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
