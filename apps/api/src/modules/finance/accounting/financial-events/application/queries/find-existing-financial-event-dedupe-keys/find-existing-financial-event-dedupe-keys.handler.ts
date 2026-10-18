import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindExistingFinancialEventDedupeKeysQuery } from './find-existing-financial-event-dedupe-keys.query';
import { FindExistingFinancialEventDedupeKeysResponse } from './find-existing-financial-event-dedupe-keys.response';
import {
  FINANCIAL_EVENT_QUERY_REPOSITORY,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(FindExistingFinancialEventDedupeKeysQuery)
export class FindExistingFinancialEventDedupeKeysHandler implements IQueryHandler<
  FindExistingFinancialEventDedupeKeysQuery,
  FindExistingFinancialEventDedupeKeysResponse
> {
  constructor(
    @Inject(FINANCIAL_EVENT_QUERY_REPOSITORY)
    private readonly financialEventQueryRepo: IFinancialEventQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: FindExistingFinancialEventDedupeKeysQuery
  ): Promise<FindExistingFinancialEventDedupeKeysResponse> {
    const { filter, ctx } = query.payload;

    // Kapsam defterin sahibinden doğrulanır; anahtar listesi istekten geliyor,
    // kapsam ondan türetilmez (anahtar global tekil olduğu için bir başkasının
    // anahtarını sorup "var/yok" bilgisi sızdırmak mümkün olurdu).
    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check(
        (p) => p.canAccessClinicFinances(filter.clinicId),
        'Bu kliniğin ekonomik olaylarına erişim yetkiniz yok.'
      )
      .orThrow('financial-event.existing-dedupe-keys');

    const data =
      await this.financialEventQueryRepo.findExistingDedupeKeys(filter);

    return { data };
  }
}
