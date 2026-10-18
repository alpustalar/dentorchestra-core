import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import {
  FINANCIAL_EVENT_QUERY_REPOSITORY,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';
import { GetClinicsWithUnpostedFinancialEventsQuery } from './get-clinics-with-unposted-financial-events.query';
import { GetClinicsWithUnpostedFinancialEventsResponse } from './get-clinics-with-unposted-financial-events.response';

/**
 * Süpürme işinin hedef kümesi. Tek klinik kapsamı olmadığı için yetki kontrolü
 * kapsam değil **düzey** sorar: yalnız sistem yöneticisi bütün defterleri
 * tarayabilir. Sistem aktörü (zamanlanmış iş) `PolicyEvaluator` içinde muaftır.
 *
 * Kapsamsız bir sorgunun yetkisiz kalması, klinik personeline "hangi kliniklerde
 * muhasebe açığı var" listesini — yani başka kiracıların kimliklerini — verirdi.
 */
@QueryHandler(GetClinicsWithUnpostedFinancialEventsQuery)
export class GetClinicsWithUnpostedFinancialEventsHandler implements IQueryHandler<
  GetClinicsWithUnpostedFinancialEventsQuery,
  GetClinicsWithUnpostedFinancialEventsResponse
> {
  constructor(
    @Inject(FINANCIAL_EVENT_QUERY_REPOSITORY)
    private readonly financialEventRepo: IFinancialEventQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetClinicsWithUnpostedFinancialEventsQuery
  ): Promise<GetClinicsWithUnpostedFinancialEventsResponse> {
    const { filter, ctx } = query.payload;

    this.policyFactory
      .finance(ctx.actor, ctx.source)
      .evaluator.check((p) => p.isSystemAdmin())
      .orThrow(ACCOUNTING_EVENTS.UNPOSTED_FINANCIAL_EVENTS);

    const clinicIds =
      await this.financialEventRepo.findClinicsWithUnposted(filter);

    return { data: clinicIds };
  }
}
