import { Module } from '@nestjs/common';
import { SubscriptionChargeCommandRepository } from '@modules/platform/subscription/infrastructure/persistence/prisma/repositories/subscription-charge/subscription-charge.command.repository';
import { SUBSCRIPTION_CHARGE_COMMAND_REPOSITORY } from '@modules/platform/subscription/domain/repositories/subscription-charge/subscription-charge.command.repository';

@Module({
  providers: [
    {
      provide: SUBSCRIPTION_CHARGE_COMMAND_REPOSITORY,
      useClass: SubscriptionChargeCommandRepository,
    },
  ],
  exports: [SUBSCRIPTION_CHARGE_COMMAND_REPOSITORY],
})
export class SubscriptionChargeRepositoryModule {}
