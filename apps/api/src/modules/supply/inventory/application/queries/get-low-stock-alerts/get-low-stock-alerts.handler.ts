import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetLowStockAlertsQuery } from './get-low-stock-alerts.query';
import { GetLowStockAlertsResponse } from './get-low-stock-alerts.response';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';
import {
  IProductQueryRepository,
  PRODUCT_QUERY_REPOSITORY,
} from '@modules/supply/inventory/domain/repositories/product/product.query.repository';
import { INVENTORY_EVENTS } from '@src/domain/constants/events';

@QueryHandler(GetLowStockAlertsQuery)
export class GetLowStockAlertsHandler implements IQueryHandler<
  GetLowStockAlertsQuery,
  GetLowStockAlertsResponse
> {
  constructor(
    @Inject(PRODUCT_QUERY_REPOSITORY)
    private readonly productRepo: IProductQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(
    query: GetLowStockAlertsQuery
  ): Promise<GetLowStockAlertsResponse> {
    const { clinicId, ctx } = query;

    const { evaluator, policy } = this.policyFactory.clinic(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.actorCanAccessTargetClinic(clinicId),
        'Bu kliniğin stok uyarılarına erişim yetkiniz yok.'
      )
      .orThrow(INVENTORY_EVENTS.LOW_STOCK_ALERTS);

    const alerts = await this.productRepo.getLowStockAlerts(clinicId);

    return {
      data: alerts,
      meta: {
        serializationOptions: policy.getSerializationOptions({ clinicId }),
      },
    };
  }
}
