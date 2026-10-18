import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetAccountingPeriodsQuery } from './get-accounting-periods.query';
import { GetAccountingPeriodsResponse } from './get-accounting-periods.response';
import {
  ACCOUNTING_PERIOD_QUERY_REPOSITORY,
  IAccountingPeriodQueryRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetAccountingPeriodsQuery)
export class GetAccountingPeriodsHandler implements IQueryHandler<
  GetAccountingPeriodsQuery,
  GetAccountingPeriodsResponse
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_QUERY_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetAccountingPeriodsQuery
  ): Promise<GetAccountingPeriodsResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin muhasebe dönemlerine erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.PERIODS);

    const periods = await this.accountingPeriodRepo.findAllByClinicId(clinicId);

    return {
      data: periods,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
