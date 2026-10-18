import { Module } from '@nestjs/common';
import { SubscriptionController } from '@modules/platform/subscription/presentation/http/controllers/subscription.controller';
import { SubscriptionAdminQueryController } from '@modules/platform/subscription/presentation/http/controllers/subscription-admin.query.controller';
import { SubscriptionAdminCommandController } from '@modules/platform/subscription/presentation/http/controllers/subscription-admin.command.controller';
import { ModuleEntitlementGuard } from '@modules/platform/subscription/presentation/guards/module-entitlement.guard';
import { SubscriptionCacheModule } from '@modules/platform/subscription/infrastructure/cache/subscription-cache.module';

@Module({
  imports: [SubscriptionCacheModule],
  controllers: [
    SubscriptionController,
    SubscriptionAdminQueryController,
    SubscriptionAdminCommandController,
  ],
  providers: [ModuleEntitlementGuard],
  exports: [ModuleEntitlementGuard],
})
export class SubscriptionPresentationModule {}
