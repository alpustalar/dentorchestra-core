import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetChartOfAccountsQuery } from './get-chart-of-accounts.query';
import { GetChartOfAccountsResponse } from './get-chart-of-accounts.response';
import {
  ACCOUNT_QUERY_REPOSITORY,
  IAccountQueryRepository,
} from '@modules/finance/accounting/chart-of-accounts/domain/repositories/account/account.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetChartOfAccountsQuery)
export class GetChartOfAccountsHandler implements IQueryHandler<
  GetChartOfAccountsQuery,
  GetChartOfAccountsResponse
> {
  constructor(
    @Inject(ACCOUNT_QUERY_REPOSITORY)
    private readonly accountRepo: IAccountQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetChartOfAccountsQuery
  ): Promise<GetChartOfAccountsResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow(ACCOUNTING_EVENTS.CHART_OF_ACCOUNTS);

    const accounts = await this.accountRepo.findAllByClinicId(clinicId);

    return {
      data: accounts,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
