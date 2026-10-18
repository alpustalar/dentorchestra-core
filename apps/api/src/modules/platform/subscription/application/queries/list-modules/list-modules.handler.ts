import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ListModulesQuery } from './list-modules.query';
import { ListModulesResponse } from './list-modules.response';
import {
  ISubscriptionQueryRepository,
  SUBSCRIPTION_QUERY_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.query.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@QueryHandler(ListModulesQuery)
export class ListModulesHandler implements IQueryHandler<
  ListModulesQuery,
  ListModulesResponse
> {
  constructor(
    @Inject(SUBSCRIPTION_QUERY_REPOSITORY)
    private readonly subscriptiobRepo: ISubscriptionQueryRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory
  ) {}

  async execute(query: ListModulesQuery): Promise<ListModulesResponse> {
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

    const modules = await this.subscriptiobRepo.findActiveModules();
    return {
      data: modules,
      meta: { serializationOptions: policy.getSerializationOptions() },
    };
  }
}
