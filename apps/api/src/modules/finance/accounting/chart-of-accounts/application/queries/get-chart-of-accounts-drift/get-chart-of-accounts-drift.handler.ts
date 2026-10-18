import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  ACCOUNT_QUERY_REPOSITORY,
  IAccountQueryRepository,
} from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { ChartTemplateIntegrity } from '@modules/finance/accounting/chart-of-accounts/domain/services/template-integrity';
import { GetChartOfAccountsDriftQuery } from './get-chart-of-accounts-drift.query';
import { GetChartOfAccountsDriftResponse } from './get-chart-of-accounts-drift.response';

@QueryHandler(GetChartOfAccountsDriftQuery)
export class GetChartOfAccountsDriftHandler implements IQueryHandler<
  GetChartOfAccountsDriftQuery,
  GetChartOfAccountsDriftResponse
> {
  constructor(
    @Inject(ACCOUNT_QUERY_REPOSITORY)
    private readonly accountRepo: IAccountQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetChartOfAccountsDriftQuery
  ): Promise<GetChartOfAccountsDriftResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow(ACCOUNTING_EVENTS.CHART_OF_ACCOUNTS_DRIFT);

    const accounts = await this.accountRepo.findAllByClinicId(clinicId);

    return {
      data: ChartTemplateIntegrity.detectDrift({ clinicId, accounts }),
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
