import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetActiveSubscriptionQuery } from './get-active-subscription.query';
import { GetActiveSubscriptionQueryResponse } from './get-active-subscription.response';
import { QueryResponse } from '@shared/common/response/response.interface';
import { PlanIdType as PlanId } from '@input-type-schemas/PlanIdSchema';
import {
  IPlanQueryRepository,
  PLAN_QUERY_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/plan/plan.query.repository';
import {
  ISubscriptionQueryRepository,
  SUBSCRIPTION_QUERY_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.query.repository';

@QueryHandler(GetActiveSubscriptionQuery)
export class GetActiveSubscriptionHandler implements IQueryHandler<
  GetActiveSubscriptionQuery,
  QueryResponse<GetActiveSubscriptionQueryResponse | null>
> {
  constructor(
    @Inject(SUBSCRIPTION_QUERY_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionQueryRepository,
    @Inject(PLAN_QUERY_REPOSITORY)
    private readonly planRepo: IPlanQueryRepository
  ) {}

  async execute(
    query: GetActiveSubscriptionQuery
  ): Promise<QueryResponse<GetActiveSubscriptionQueryResponse | null>> {
    const data = await this.subscriptionRepo.findByOrganizationId(
      query.organizationId
    );
    if (!data) return { data: null };

    // Aboneliğin plan item'ından plan bundle modüllerini türet (entitlement görünümü).
    const planItem = data.items.find((item) => item.planId != null);
    if (planItem?.planId) {
      const plan = await this.planRepo.findByPlanIdWithModules(
        planItem.planId as PlanId
      );
      if (plan) data.planModules = plan.modules;
    }

    return { data };
  }
}
