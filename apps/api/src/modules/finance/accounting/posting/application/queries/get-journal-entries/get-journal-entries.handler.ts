import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers/paginate.helper';
import {
  IJournalQueryRepository,
  JOURNAL_QUERY_REPOSITORY,
} from '@modules/finance/accounting/posting/domain/repositories/journal.repository';
import { GetJournalEntriesQuery } from './get-journal-entries.query';
import { GetJournalEntriesResponse } from './get-journal-entries.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  ITenantScopeResolver,
  TENANT_SCOPE_RESOLVER,
} from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';

@QueryHandler(GetJournalEntriesQuery)
export class GetJournalEntriesHandler implements IQueryHandler<
  GetJournalEntriesQuery,
  GetJournalEntriesResponse
> {
  constructor(
    @Inject(JOURNAL_QUERY_REPOSITORY)
    private readonly journalQueryRepo: IJournalQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver
  ) {}

  async execute(
    query: GetJournalEntriesQuery
  ): Promise<GetJournalEntriesResponse> {
    const { pagination, status, periodId, clinicId, ctx } = query.payload;
    // `clinicId` sorgu dizesinden geliyor — aktörün kendi kliniği DEĞİL. Kontrol
    // yokken bu yetkiye sahip herhangi bir personel başka bir organizasyonun
    // yevmiye defterini okuyabiliyordu; `getOrganizationSerializationOptions`
    // yalnız ALAN maskeler, SATIR erişimini kısıtlamaz.
    const { evaluator, policy } = this.policyFactory.finance(
      ctx.actor,
      ctx.source
    );
    evaluator
      .check((p) => p.canAccessClinicFinances(clinicId))
      .orThrow('accounting.journal.list');

    const organizationId = await this.tenantScopeResolver.resolve(
      query.payload
    );

    // Erişim `clinicId` için doğrulandı; liste de AYNI klinikle süzülür. Yalnız
    // organizationId ile süzmek erişim kontrolünü yanıltıcı kılar: kontrol "bu klinik"
    // için yapılır, satırlar "bu organizasyonun tüm klinikleri"nden gelirdi.
    const { items, total } = await this.journalQueryRepo.findMany(
      { clinicId, organizationId, status, periodId },
      pagination
    );

    return {
      data: items,
      meta: {
        pagination: buildPaginationMeta(pagination, total),
        serializationOptions: policy.getOrganizationSerializationOptions({
          organizationId,
        }),
      },
    };
  }
}
