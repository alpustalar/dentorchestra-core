import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ResumeSubscriptionCommand } from './resume-subscription.command';
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

@CommandHandler(ResumeSubscriptionCommand)
export class ResumeSubscriptionHandler implements ICommandHandler<
  ResumeSubscriptionCommand,
  void
> {
  constructor(
    @Inject(SUBSCRIPTION_COMMAND_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionCommandRepository,
    @Inject(POLICY_FACTORY)
    private readonly policyFactory: IPolicyFactory,
    private readonly txManager: TransactionManager
  ) {}

  async execute(command: ResumeSubscriptionCommand): Promise<void> {
    const subscription = await this.subscriptionRepo.findById(
      command.subscriptionId
    );
    if (!subscription) throw new SubscriptionNotFoundException();

    await this.txManager.run(async () => {
      subscription
        .rules(
          this.policyFactory
            .entity(command.ctx.actor, command.ctx.source)
            .policy.getValidateOptions()
        )
        .undoCancellation()
        .orThrow();
      subscription.undoCancellation();
      await this.subscriptionRepo.update(subscription);
    });
  }
}
