import { SetPlanModulesHandler } from './set-plan-modules.handler';
import { SetPlanModulesCommand } from './set-plan-modules.command';
import { Plan } from '@modules/platform/subscription/domain/entities/plan.entity';
import { SubscriptionPlanNotFoundException } from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import { IPlanCommandRepository } from '@modules/platform/subscription/domain/repositories/plan/plan.command.repository';

describe('SetPlanModulesHandler', () => {
  const build = (plan: Plan | null) => {
    const planCommandRepo = {
      findByPlanId: jest.fn().mockResolvedValue(plan),
      setModules: jest.fn().mockResolvedValue(undefined),
    } as unknown as IPlanCommandRepository;
    return {
      handler: new SetPlanModulesHandler(planCommandRepo),
      planCommandRepo,
    };
  };

  const cmd = (moduleIds: string[]) =>
    new SetPlanModulesCommand({
      planId: 'BASIC',
      moduleIds,
      actor: { userId: 'admin' } as never,
    });

  it('plan bulunur → setModules planın satır id + modül kümesiyle çağrılır', async () => {
    const plan = Plan.create({
      planId: 'BASIC',
      name: 'Basic',
      monthlyPrice: 100,
      currency: 'TRY',
    });
    const t = build(plan);

    await t.handler.execute(cmd(['m1', 'm2']));

    expect(t.planCommandRepo.setModules).toHaveBeenCalledWith(plan.id.value, [
      'm1',
      'm2',
    ]);
  });

  it('plan yok → SubscriptionPlanNotFoundException', async () => {
    const t = build(null);
    await expect(t.handler.execute(cmd(['m1']))).rejects.toBeInstanceOf(
      SubscriptionPlanNotFoundException
    );
    expect(t.planCommandRepo.setModules).not.toHaveBeenCalled();
  });
});
