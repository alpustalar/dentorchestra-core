import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetProductStockQuery } from './get-product-stock.query';
import { GetProductStockResponse } from './get-product-stock.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IProductQueryRepository,
  PRODUCT_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.query.repository';

@QueryHandler(GetProductStockQuery)
export class GetProductStockHandler implements IQueryHandler<
  GetProductStockQuery,
  GetProductStockResponse
> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY)
    private readonly productRepo: IProductQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: GetProductStockQuery): Promise<GetProductStockResponse> {
    const { clinicId, ctx } = query;

    const levels = await this.productRepo.getStockLevels(clinicId);

    return {
      data: levels,
      meta: {
        serializationOptions: this.policyFactory
          .clinic(ctx.actor, ctx.source)
          .policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
