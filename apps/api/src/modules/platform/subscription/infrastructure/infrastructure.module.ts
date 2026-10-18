import { Module } from '@nestjs/common';
import { SubscriptionRepositoriesModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/repositories.module';
import { SubscriptionEventModule } from '@modules/platform/subscription/infrastructure/messaging/events/subscription-event.module';
import { SubscriptionCacheModule } from '@modules/platform/subscription/infrastructure/cache/subscription-cache.module';

const SubscriptionInfrastructureModules = [
  SubscriptionRepositoriesModule,
  SubscriptionEventModule,
  SubscriptionCacheModule,
];

@Module({
  imports: [...SubscriptionInfrastructureModules],
  exports: [...SubscriptionInfrastructureModules],
})
export class SubscriptionInfrastructureModule {}
