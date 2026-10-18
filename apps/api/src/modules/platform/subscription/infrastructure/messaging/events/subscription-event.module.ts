import { Module } from '@nestjs/common';
import { EntitlementCacheInvalidationListener } from './listeners/entitlement-cache-invalidation.listener';
import { SubscriptionCacheModule } from '@modules/platform/subscription/infrastructure/cache/subscription-cache.module';

@Module({
  imports: [SubscriptionCacheModule],
  providers: [EntitlementCacheInvalidationListener],
})
export class SubscriptionEventModule {}
