import { Module } from '@nestjs/common';
import { SUBSCRIPTION_CACHE_SERVICE } from '@modules/platform/subscription/domain/interfaces/subscription-cache.service.interface';
import { SubscriptionCacheService } from '@modules/platform/subscription/infrastructure/cache/subscription-cache.service';

/**
 * Entitlement cache'ini token üzerinden sağlar. Ayrı bir modül olmasının sebebi
 * hem altyapı modülünün hem olay dinleyicisi modülünün aynı örneği kullanabilmesi;
 * dinleyici daha önce sınıfı doğrudan inject ediyordu ve sınıf hiçbir modülde
 * provider olmadığı için modül ayağa kalkamıyordu.
 */
@Module({
  providers: [
    { provide: SUBSCRIPTION_CACHE_SERVICE, useClass: SubscriptionCacheService },
  ],
  exports: [SUBSCRIPTION_CACHE_SERVICE],
})
export class SubscriptionCacheModule {}
