import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindPeriodByDateQuery } from './find-period-by-date.query';
import { FindPeriodByDateResponse } from './find-period-by-date.response';
import {
  ACCOUNTING_PERIOD_QUERY_REPOSITORY,
  IAccountingPeriodQueryRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@QueryHandler(FindPeriodByDateQuery)
export class FindPeriodByDateHandler implements IQueryHandler<
  FindPeriodByDateQuery,
  FindPeriodByDateResponse
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_QUERY_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindPeriodByDateQuery
  ): Promise<FindPeriodByDateResponse> {
    const { clinicId, date, ctx } = query;

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.canAccessClinicFinances(clinicId),
        'Bu kliniğin muhasebe dönemine erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.PERIOD_BY_DATE);

    const period = await this.accountingPeriodRepo.findByDate(clinicId, date);

    return {
      data: period,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
