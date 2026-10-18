import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { UpsertPlanCommand } from './upsert-plan.command';
import { Plan } from '@modules/platform/subscription/domain/entities/plan.entity';
import {
  IPlanCommandRepository,
  PLAN_COMMAND_REPOSITORY,
} from '@modules/platform/subscription/domain/repositories/plan/plan.command.repository';

@CommandHandler(UpsertPlanCommand)
export class UpsertPlanHandler implements ICommandHandler<
  UpsertPlanCommand,
  string
> {
  constructor(
    @Inject(PLAN_COMMAND_REPOSITORY)
    private readonly planRepo: IPlanCommandRepository
  ) {}

  async execute(command: UpsertPlanCommand): Promise<string> {
    const plan = Plan.create({
      planId: command.planId,
      name: command.name,
      monthlyPrice: command.monthlyPrice,
      currency: command.currency,
    });
    const saved = await this.planRepo.upsertByPlanId(plan);
    return saved.id.value;
  }
}
