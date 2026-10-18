import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { GetUnpostedFinancialEventsQuery } from './get-unposted-financial-events.query';
import { GetUnpostedFinancialEventsResponse } from './get-unposted-financial-events.response';
import {
  FINANCIAL_EVENT_QUERY_REPOSITORY,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

/**
 * Mutabakat listesi: aralıkta fişlenmemiş (fişi hiç olmayan ya da DRAFT kalan)
 * ekonomik olaylar. Posting hatası dinleyicide yutulduğu için bu liste, "olay
 * kaydedildi ama mizana girmedi" durumunun tek görünür yüzüdür.
 */
@QueryHandler(GetUnpostedFinancialEventsQuery)
export class GetUnpostedFinancialEventsHandler implements IQueryHandler<
  GetUnpostedFinancialEventsQuery,
  GetUnpostedFinancialEventsResponse
> {
  constructor(
    @Inject(FINANCIAL_EVENT_QUERY_REPOSITORY)
    private readonly financialEventRepo: IFinancialEventQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetUnpostedFinancialEventsQuery
  ): Promise<GetUnpostedFinancialEventsResponse> {
    const { filter, pagination, ctx } = query.payload;

    // `clinicId` istekten geliyor — aktörün kendi kliniği DEĞİL.
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check((p) => p.canAccessClinicFinances(filter.clinicId))
      .orThrow(ACCOUNTING_EVENTS.UNPOSTED_FINANCIAL_EVENTS);

    const { items, total } = await this.financialEventRepo.findUnpostedInRange(
      filter,
      pagination
    );

    return {
      data: items,
      meta: {
        pagination: buildPaginationMeta(pagination, total),
        serializationOptions: policy.getSerializationOptions({
          clinicId: filter.clinicId,
        }),
      },
    };
  }
}
