import { Module } from '@nestjs/common';
import { SubscriptionRepositoryModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/subscription/subscription.repository.module';
import { SubscriptionItemRepositoryModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/subscription-item/subscription-item.repository.module';
import { SubscriptionModuleRepositoryModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/module/module.repository.module';
import { PlanRepositoryModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/plan/plan.repository.module';
import { SubscriptionPaymentMethodRepositoryModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/subscription-payment-method/subscription-payment-method.repository.module';
import { SubscriptionChargeRepositoryModule } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/subscription-charge/subscription-charge.repository.module';

@Module({
  imports: [
    SubscriptionRepositoryModule,
    SubscriptionItemRepositoryModule,
    SubscriptionModuleRepositoryModule,
    PlanRepositoryModule,
    SubscriptionPaymentMethodRepositoryModule,
    SubscriptionChargeRepositoryModule,
  ],
  exports: [
    SubscriptionRepositoryModule,
    SubscriptionItemRepositoryModule,
    SubscriptionModuleRepositoryModule,
    PlanRepositoryModule,
    SubscriptionPaymentMethodRepositoryModule,
    SubscriptionChargeRepositoryModule,
  ],
})
export class SubscriptionRepositoriesModule {}
