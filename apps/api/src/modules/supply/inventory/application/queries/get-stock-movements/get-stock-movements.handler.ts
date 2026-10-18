import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetStockMovementsQuery } from './get-stock-movements.query';
import { GetStockMovementsResponse } from './get-stock-movements.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import { buildPaginationMeta } from '@src/infrastructure/persistence/prisma/helpers';
import {
  IStockMovementQueryRepository,
  STOCK_MOVEMENT_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/stock-movement/stock-movement.query.repository';
import { INVENTORY_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetStockMovementsQuery)
export class GetStockMovementsHandler implements IQueryHandler<
  GetStockMovementsQuery,
  GetStockMovementsResponse
> {
  constructor(
    @Inject(STOCK_MOVEMENT_QUERY_REPOSITORY)
    private readonly stockMovementRepo: IStockMovementQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetStockMovementsQuery
  ): Promise<GetStockMovementsResponse> {
    const { payload } = query;
    const { clinicId, data, ctx, pagination } = payload;
    const { actor, source } = ctx;

    const { evaluator, policy } = this.policyFactory.clinic(actor, source);

    evaluator
      .check(
        (p) => p.actorCanAccessTargetClinic(clinicId),
        'Bu kliniğin stok hareketlerine erişim yetkiniz yok.'
      )
      .orThrow(INVENTORY_EVENTS.STOCK_MOVEMENTS);

    const result = data.productId
      ? await this.stockMovementRepo.findManyByProduct(
          data.productId,
          clinicId,
          pagination
        )
      : await this.stockMovementRepo.findManyByClinic(clinicId, pagination);

    return {
      data: result.items,
      meta: {
        pagination: buildPaginationMeta(pagination, result.total),
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
