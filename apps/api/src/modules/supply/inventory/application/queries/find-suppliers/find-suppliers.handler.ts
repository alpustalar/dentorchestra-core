import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { FindSuppliersQuery } from './find-suppliers.query';
import { FindSuppliersResponse } from './find-suppliers.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  ISupplierQueryRepository,
  SUPPLIER_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/supplier/supplier.query.repository';

@QueryHandler(FindSuppliersQuery)
export class FindSuppliersHandler implements IQueryHandler<
  FindSuppliersQuery,
  FindSuppliersResponse
> {
  constructor(
    @Inject(SUPPLIER_QUERY_REPOSITORY)
    private readonly supplierRepo: ISupplierQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: FindSuppliersQuery): Promise<FindSuppliersResponse> {
    const { payload } = query;
    const { pagination, ctx, organizationId } = payload;

    const { evaluator, policy } = this.policyFactory.clinic(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.actorCanAccessTargetClinic(ctx.actor.clinicId),
        'Tedarikçi listesine erişim yetkiniz yok.'
      )
      .orThrow('supplier.list');

    const result = await this.supplierRepo.findMany(organizationId, pagination);

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({
          clinicId: ctx.actor.clinicId,
        }),
      },
    };
  }
}
