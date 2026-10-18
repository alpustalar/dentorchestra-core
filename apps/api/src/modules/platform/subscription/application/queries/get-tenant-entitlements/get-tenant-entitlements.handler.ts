import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetTenantEntitlementsQuery } from './get-tenant-entitlements.query';
import { GetTenantEntitlementsResponse } from './get-tenant-entitlements.response';
import { PlanIdType as PlanId } from '@input-type-schemas/PlanIdSchema';
import { TenantEntitlements } from '@common/interfaces';
import { SUBSCRIPTION_GRACE_DAYS } from '@common/constants';
import {
  ISubscriptionQueryRepository,
  SUBSCRIPTION_QUERY_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.query.repository';
import {
  IPlanQueryRepository,
  PLAN_QUERY_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/plan/plan.query.repository';
import {
  resolveEffectivePlanId,
  subscriptionGrantsAccess,
} from '@modules/platform/subscription/domain/services/entitlement-access.policy';

const EMPTY_ENTITLEMENTS: TenantEntitlements = {
  modules: [],
  planId: null,
  status: null,
  active: false,
  trialEndsAt: null,
};

@QueryHandler(GetTenantEntitlementsQuery)
export class GetTenantEntitlementsHandler implements IQueryHandler<
  GetTenantEntitlementsQuery,
  GetTenantEntitlementsResponse
> {
  constructor(
    @Inject(SUBSCRIPTION_QUERY_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionQueryRepository,
    @Inject(PLAN_QUERY_REPOSITORY)
    private readonly planRepo: IPlanQueryRepository
  ) {}

  async execute(
    query: GetTenantEntitlementsQuery
  ): Promise<GetTenantEntitlementsResponse> {
    const source = await this.subscriptionRepo.findEntitlementSource({
      organizationId: query.organizationId,
      clinicId: query.clinicId,
    });

    if (!source) return { data: EMPTY_ENTITLEMENTS };

    const active = subscriptionGrantsAccess(source, SUBSCRIPTION_GRACE_DAYS);
    const trialEndsAt = source.trialEndsAt?.toISOString() ?? null;

    // Erişim yoksa (EXPIRED / grace bitmiş / deneme dolmuş) modül verilmez; görüntü alanları kalır.
    if (!active) {
      return {
        data: {
          modules: [],
          planId: source.planId,
          status: source.status,
          active: false,
          trialEndsAt,
        },
      };
    }

    const modules = await this.resolveModules(
      source.planId,
      source.addOnModuleKeys
    );

    return {
      data: {
        modules,
        planId: source.planId,
        status: source.status,
        active: true,
        trialEndsAt,
      },
    };
  }

  /** Efektif planın bundle modülleri ∪ eklenti modüller (tekilleştirilmiş). */
  private async resolveModules(
    planId: string | null,
    addOnModuleKeys: string[]
  ): Promise<string[]> {
    const keys = new Set<string>(addOnModuleKeys);

    const effectivePlanId = resolveEffectivePlanId(planId);
    if (effectivePlanId) {
      const plan = await this.planRepo.findByPlanIdWithModules(
        effectivePlanId as PlanId
      );
      plan?.modules.forEach((m) => keys.add(m.key));
    }

    return [...keys];
  }
}
