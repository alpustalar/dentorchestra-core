import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import { GetFinancialEventsQuery } from './get-financial-events.query';
import { GetFinancialEventsResponse } from './get-financial-events.response';
import {
  FINANCIAL_EVENT_QUERY_REPOSITORY,
  IFinancialEventQueryRepository,
} from '@modules/finance/accounting/financial-events/domain/repositories/financial-event/financial-event.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ACCOUNTING_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetFinancialEventsQuery)
export class GetFinancialEventsHandler implements IQueryHandler<
  GetFinancialEventsQuery,
  GetFinancialEventsResponse
> {
  constructor(
    @Inject(FINANCIAL_EVENT_QUERY_REPOSITORY)
    private readonly financialEventRepo: IFinancialEventQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver
  ) {}

  async execute(
    query: GetFinancialEventsQuery
  ): Promise<GetFinancialEventsResponse> {
    const { pagination, type, sourceModule, sourceRefId, clinicId, ctx } =
      query.payload;

    // `clinicId` sorgu dizesinden geliyor — aktörün kendi kliniği DEĞİL.
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow(ACCOUNTING_EVENTS.FINANCIAL_EVENTS);

    const organizationId = await this.tenantScopeResolver.resolve(
      query.payload
    );

    // Yetki klinik seviyesinde verildi → satırlar da klinik seviyesinde gelir.
    // Yalnız `organizationId` ile filtrelemek, tek şubeye erişimi olan personele
    // organizasyondaki tüm şubelerin finansal olay defterini açıyordu;
    // serileştirme yalnız ALAN maskeler, SATIR erişimini kısıtlamaz.
    const { items, total } = await this.financialEventRepo.findMany(
      { clinicId, organizationId, type, sourceModule, sourceRefId },
      pagination
    );

    return {
      data: items,
      meta: {
        pagination: buildPaginationMeta(pagination, total),
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
