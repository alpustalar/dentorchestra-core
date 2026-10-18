import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_MODULE_KEY } from '@common/decorators/requires-module.decorator';
import { IRequestWithActor, TenantEntitlements } from '@common/interfaces';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetTenantEntitlementsQuery } from '@modules/platform/subscription/application/queries/get-tenant-entitlements/get-tenant-entitlements.query';
import { SubscriptionModuleRequiredException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import {
  ISubscriptionCacheService,
  SUBSCRIPTION_CACHE_SERVICE,
} from '@modules/platform/subscription/domain/interfaces/subscription-cache.service.interface';
import { Priority } from '@src/domain/value-objects/priority.vo';

/**
 * Kiracının (org/klinik) aboneliğinde `@RequiresModule` ile belirtilen modülün açık olmasını şart koşar.
 * Tenant-anahtarlı Redis cache'i read-through okur; miss'te `GetTenantEntitlementsQuery` ile çözer.
 * Modül yoksa veya abonelik pasifse 402 (`SubscriptionModuleRequiredException`) fırlatır.
 */
@Injectable()
export class ModuleEntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly queryBus: TSQueryBus,
    @Inject(SUBSCRIPTION_CACHE_SERVICE)
    private readonly cacheService: ISubscriptionCacheService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRES_MODULE_KEY,
      [context.getHandler(), context.getClass()]
    );
    if (!requiredModule) return true;

    const moduleKey = requiredModule.toLowerCase();
    const request = context.switchToHttp().getRequest<IRequestWithActor>();
    const actor = request.actor;

    if (!actor) {
      throw new SubscriptionModuleRequiredException({
        requiredModule: moduleKey,
        currentPlanId: null,
      });
    }

    const priority = Priority.create(actor.rolePriority).orThrow();
    if (priority.validate.isAdmin.value) return true;

    if (!actor.organizationId) {
      throw new SubscriptionModuleRequiredException({
        requiredModule: moduleKey,
        currentPlanId: null,
      });
    }

    const entitlements = await this.resolveEntitlements(
      actor.organizationId,
      actor.clinicId ?? null
    );

    if (!entitlements.active || !entitlements.modules.includes(moduleKey)) {
      throw new SubscriptionModuleRequiredException({
        requiredModule: moduleKey,
        currentPlanId: entitlements.planId,
      });
    }

    return true;
  }

  private async resolveEntitlements(
    organizationId: string,
    clinicId: string | null
  ): Promise<TenantEntitlements> {
    const cached = await this.cacheService.tenantEntitlements.get(
      organizationId,
      clinicId
    );
    if (cached) return cached;

    const { data } = await this.queryBus.execute(
      new GetTenantEntitlementsQuery(organizationId, clinicId)
    );
    await this.cacheService.tenantEntitlements.set({
      organizationId,
      clinicId,
      entitlements: data,
    });
    return data;
  }
}
