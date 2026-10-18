import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetFinancialEventByIdQuery } from './get-financial-event-by-id.query';
import { GetFinancialEventByIdResponse } from './get-financial-event-by-id.response';
import {
  FINANCIAL_EVENT_QUERY_REPOSITORY,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetFinancialEventByIdQuery)
export class GetFinancialEventByIdHandler implements IQueryHandler<
  GetFinancialEventByIdQuery,
  GetFinancialEventByIdResponse
> {
  constructor(
    @Inject(FINANCIAL_EVENT_QUERY_REPOSITORY)
    private readonly financialEventRepo: IFinancialEventQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetFinancialEventByIdQuery
  ): Promise<GetFinancialEventByIdResponse> {
    const { financialEventId, ctx } = query;

    const event = await this.financialEventRepo.findById(financialEventId);

    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );

    // Klinik bağı olayın kendisinden çözülür — id tahmini kapıda durdurulur.
    evaluator
      .check(
        (p) => !event || p.canAccessClinicFinances(event.clinicId),
        'Bu finansal olaya erişim yetkiniz yok.'
      )
      .orThrow(ACCOUNTING_EVENTS.FINANCIAL_EVENT_DETAIL);

    return {
      data: event,
      meta: {
        serializationOptions: policy.getSerializationOptions({
          clinicId: event?.clinicId ?? '',
        }),
      },
    };
  }
}
