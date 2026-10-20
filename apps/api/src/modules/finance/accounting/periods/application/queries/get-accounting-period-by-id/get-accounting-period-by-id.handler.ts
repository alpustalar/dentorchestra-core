import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  ACCOUNTING_PERIOD_QUERY_REPOSITORY,
  IAccountingPeriodQueryRepository,
} from '@modules/finance/accounting/periods/domain/repositories/accounting-period/accounting-period.query.repository';
import { PeriodNotFoundException } from '@modules/finance/accounting/periods/domain/exceptions/period.exceptions';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { GetAccountingPeriodByIdQuery } from './get-accounting-period-by-id.query';
import { GetAccountingPeriodByIdResponse } from './get-accounting-period-by-id.response';

@QueryHandler(GetAccountingPeriodByIdQuery)
export class GetAccountingPeriodByIdHandler implements IQueryHandler<
  GetAccountingPeriodByIdQuery,
  GetAccountingPeriodByIdResponse
> {
  constructor(
    @Inject(ACCOUNTING_PERIOD_QUERY_REPOSITORY)
    private readonly accountingPeriodRepo: IAccountingPeriodQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetAccountingPeriodByIdQuery
  ): Promise<GetAccountingPeriodByIdResponse> {
    const { periodId, ctx } = query;

    const period = await this.accountingPeriodRepo.findById(periodId);
    if (!period) throw new PeriodNotFoundException();

    // `periodId` URL'den geliyor: kapsam kaydın KENDİ kliniğinden doğrulanır.
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check(
        (p) => p.canAccessClinicFinances(period.clinicId),
        'Bu kliniğin muhasebe dönemlerine erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.PERIODS);

    return {
      data: period,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: period.clinicId,
        }),
      },
    };
  }
}
