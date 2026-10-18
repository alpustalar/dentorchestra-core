import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindProductsQuery } from './find-products.query';
import { FindProductsResponse } from './find-products.response';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IProductQueryRepository,
  PRODUCT_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { TENANT_SCOPE_RESOLVER } from '@modules/organization/clinic/domain/services/tenant-scope/tenant-scope.resolver.interface';
import { ITenantScopeResolver } from '@shared';

@QueryHandler(FindProductsQuery)
export class FindProductsHandler implements IQueryHandler<
  FindProductsQuery,
  FindProductsResponse
> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY)
    private readonly productRepo: IProductQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    @Inject(TENANT_SCOPE_RESOLVER)
    private readonly tenantScopeResolver: ITenantScopeResolver
  ) {}

  async execute(query: FindProductsQuery): Promise<FindProductsResponse> {
    const { pagination, clinicId, ctx } = query.payload;

    // Kiracı sınırı: `clinicId` istekle geliyor, kliniğin organizasyonu
    // çözülüp aktörün ona erişimi doğrulanır.
    const organizationId = await this.tenantScopeResolver.resolve({ clinicId });

    const { evaluator, policy } = this.policyFactory.clinic(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check((p) =>
        p.actorCanAccessClinicOrOwnsOrganization(clinicId, organizationId)
      )
      .orThrow('inventory.product.list');

    // Liste kliniğin kataloğu. Eskiden organizasyon kapsamında listelenip
    // serileştirme ayarları `result.items[0].clinicId`'den okunuyordu: boş
    // katalogda (ya da son sayfadan sonra) bu satır TypeError ile 500 veriyordu,
    // dolu listede ise alan görünürlüğü **rastgele bir satırın** kliniğine göre
    // hesaplanıyordu.
    const result = await this.productRepo.findMany(clinicId, pagination);

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
