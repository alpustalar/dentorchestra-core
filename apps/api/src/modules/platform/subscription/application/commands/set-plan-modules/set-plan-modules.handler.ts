import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { SetPlanModulesCommand } from './set-plan-modules.command';
import { SubscriptionPlanNotFoundException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import {
  IPlanCommandRepository,
  PLAN_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/plan/plan.command.repository';

@CommandHandler(SetPlanModulesCommand)
export class SetPlanModulesHandler implements ICommandHandler<
  SetPlanModulesCommand,
  void
> {
  constructor(
    @Inject(PLAN_COMMAND_REPOSITORY)
    private readonly planRepo: IPlanCommandRepository
  ) {}

  async execute(command: SetPlanModulesCommand): Promise<void> {
    const { payload } = command;
    // Değiştirilecek planın satırı → okuma command repo'dan.
    const plan = await this.planRepo.findByPlanId(payload.planId);
    if (!plan) {
      throw new SubscriptionPlanNotFoundException(payload.planId);
    }
    await this.planRepo.setModules(plan.id.value, payload.moduleIds);
  }
}
