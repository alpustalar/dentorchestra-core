import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListPlansQuery } from './list-plans.query';
import { ListPlansResponse } from './list-plans.response';
import {
  IPlanQueryRepository,
  PLAN_QUERY_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/plan/plan.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(ListPlansQuery)
export class ListPlansHandler implements IQueryHandler<
  ListPlansQuery,
  ListPlansResponse
> {
  constructor(
    @Inject(PLAN_QUERY_REPOSITORY)
    private readonly planRepo: IPlanQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: ListPlansQuery): Promise<ListPlansResponse> {
    const { ctx } = query;

    // Plan/modül kataloğu platform fiyatlandırmasıdır — yalnız sistem yöneticisi.
    const { evaluator, policy } = this.policyFactory.entity(
      ctx.actor,
      ctx.source
    );

    evaluator
      .check(
        (p) => p.isSystemAdmin(),
        'Abonelik kataloğunu yalnız sistem yöneticisi görüntüleyebilir.'
      )
      .orThrow('subscription-catalog.list');

    const plans = await this.planRepo.findAllActiveWithModules();
    return {
      data: plans,
      meta: { serializationOptions: policy.getSerializationOptions() },
    };
  }
}
