import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CancelSubscriptionCommand } from './cancel-subscription.command';
import { SubscriptionNotFoundException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import {
  ISubscriptionCommandRepository,
  SUBSCRIPTION_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import {
  IPolicyFactory,
  POLICY_FACTORY,
} from '@modules/platform/policy/staff/domain/interfaces/policy-factory.interface';

@CommandHandler(CancelSubscriptionCommand)
export class CancelSubscriptionHandler implements ICommandHandler<
  CancelSubscriptionCommand,
  void
> {
  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: CancelSubscriptionCommand): Promise<void> {
    const subscription = await this.subscriptionRepo.findById(
      command.payload.subscriptionId
    );

    if (!subscription) throw new SubscriptionNotFoundException();

    const validateOptions = this.policyFactory
      .entity(command.payload.ctx.actor, command.payload.ctx.source)
      .policy.getValidateOptions();

    await this.txManager.run(async () => {
      if (command.payload.immediate) {
        subscription.rules(validateOptions).cancel().orThrow();
        subscription.cancel(); // anında iptal
      } else {
        subscription.rules(validateOptions).scheduleCancellation().orThrow();
        subscription.scheduleCancellation(); // dönem sonunda iptal
      }
      await this.subscriptionRepo.update(subscription);
    });
  }
}
