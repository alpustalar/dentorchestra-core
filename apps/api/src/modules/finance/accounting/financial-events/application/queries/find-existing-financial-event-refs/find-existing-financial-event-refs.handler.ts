import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindExistingFinancialEventRefsQuery } from './find-existing-financial-event-refs.query';
import { FindExistingFinancialEventRefsResponse } from './find-existing-financial-event-refs.response';
import {
  FINANCIAL_EVENT_QUERY_REPOSITORY,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(FindExistingFinancialEventRefsQuery)
export class FindExistingFinancialEventRefsHandler implements IQueryHandler<
  FindExistingFinancialEventRefsQuery,
  FindExistingFinancialEventRefsResponse
> {
  constructor(
    @Inject(FINANCIAL_EVENT_QUERY_REPOSITORY)
    private readonly financialEventQueryRepo: IFinancialEventQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindExistingFinancialEventRefsQuery
  ): Promise<FindExistingFinancialEventRefsResponse> {
    const { filter, ctx } = query.payload;

    // Kapsam kaydın kendi kliniğinden doğrulanır: referans listesi istekten
    // geliyor, kapsam ondan türetilmez.
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.canAccessClinicFinances(filter.clinicId),
        'Bu kliniğin ekonomik olaylarına erişim yetkiniz yok.'
      )
      .orThrow('financial-event.existing-refs');

    const data =
      await this.financialEventQueryRepo.findExistingSourceRefIds(filter);

    return { data };
  }
}
