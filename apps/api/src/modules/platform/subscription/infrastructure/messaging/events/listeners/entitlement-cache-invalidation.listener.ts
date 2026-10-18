import { Inject, Injectable, Logger } from '@nestjs/common';
import { SubscriptionActivatedEvent } from '@modules/platform/subscription/domain/events/subscription-activated.event';
import { SubscriptionRenewedEvent } from '@modules/platform/subscription/domain/events/subscription-renewed.event';
import { ModuleAddedEvent } from '@modules/platform/subscription/domain/events/module-added.event';
import {
  ISubscriptionCacheService,
  SUBSCRIPTION_CACHE_SERVICE,
} from '@modules/platform/subscription/domain/interfaces/subscription-cache.service.interface';
import { OnDomainEvent } from '@common/decorators';

/**
 * Abonelik değiştiğinde (aktivasyon / yenileme / modül ekleme) kiracının entitlement cache'ini
 * bust eder — böylece satın alınan modül/plan bir sonraki istekte anında yansır. Outbox relay
 * üzerinden asenkron tetiklenir; kalıcı sızıntıyı cache TTL'i de kapatır.
 */
@Injectable()
export class EntitlementCacheInvalidationListener {
  private readonly logger = new Logger(
    EntitlementCacheInvalidationListener.name
  );

  constructor(
    @Inject(SUBSCRIPTION_CACHE_SERVICE)
    private readonly cacheService: ISubscriptionCacheService
  ) {}

  @OnDomainEvent([
    SubscriptionActivatedEvent.NAME,
    SubscriptionRenewedEvent.NAME,
    ModuleAddedEvent.NAME,
  ])
  async handle(payload: { organizationId?: string }): Promise<void> {
    if (!payload?.organizationId) return;
    try {
      await this.cacheService.tenantEntitlements.delByOrganizationId(
        payload.organizationId
      );
    } catch (err) {
      this.logger.error(
        `Entitlement cache bust hatası (organizationId: ${payload.organizationId})`,
        err
      );
    }
  }
}
