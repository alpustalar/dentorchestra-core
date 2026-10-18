import { StartTrialHandler } from './start-trial.handler';
import { StartTrialCommand } from './start-trial.command';
import { ISubscriptionCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import { ISubscriptionItemCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-item/subscription-item.command.repository';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { SubscriptionItem } from '@modules/platform/subscription/domain/entities/subscription-item.entity';
import { randomUUID } from 'crypto';

describe('StartTrialHandler', () => {
  const organizationId = randomUUID();

  const build = (opts: { exists?: boolean; billingTarget?: string }) => {
    const createdSubs: Subscription[] = [];
    const createdItems: SubscriptionItem[] = [];

    const subscriptionCommandRepo = {
      create: jest.fn(async (s: Subscription) => {
        createdSubs.push(s);
        return s;
      }),
      // Mükerrer abonelik guard'ı artık yazmayla aynı transaction içinde.
      existsByOwner: jest.fn().mockResolvedValue(opts.exists ?? false),
    } as unknown as ISubscriptionCommandRepository;

    const subscriptionItemCommandRepo = {
      create: jest.fn(async (i: SubscriptionItem) => {
        createdItems.push(i);
        return i;
      }),
    } as unknown as ISubscriptionItemCommandRepository;

    const queryBus = {
      execute: jest
        .fn()
        .mockResolvedValue({ data: opts.billingTarget ?? 'ORGANIZATION' }),
    } as unknown as TSQueryBus;

    const txManager = {
      run: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    const handler = new StartTrialHandler(
      subscriptionCommandRepo,
      subscriptionItemCommandRepo,
      queryBus,
      txManager
    );
    return {
      handler,
      subscriptionCommandRepo,
      subscriptionItemCommandRepo,
      createdSubs,
      createdItems,
    };
  };

  it('yeni org → FREE_TRIAL abonelik + item oluşturur, trialEndsAt gelecekte', async () => {
    const t = build({});
    await t.handler.execute(new StartTrialCommand(organizationId));

    expect(t.createdSubs).toHaveLength(1);
    expect(t.createdItems).toHaveLength(1);
    expect(t.createdSubs[0].trialEndsAt).toBeInstanceOf(Date);
    expect(t.createdSubs[0].trialEndsAt!.getTime()).toBeGreaterThan(Date.now());
    expect(t.createdSubs[0].status).toBe('ACTIVE');
  });

  it('zaten abonelik varsa → idempotent, oluşturmaz', async () => {
    const t = build({ exists: true });
    await t.handler.execute(new StartTrialCommand(organizationId));

    expect(t.subscriptionCommandRepo.create).not.toHaveBeenCalled();
    expect(t.subscriptionItemCommandRepo.create).not.toHaveBeenCalled();
  });

  it('CLINIC-billed ama clinicId yoksa → atlar (org kaydı)', async () => {
    const t = build({ billingTarget: 'CLINIC' });
    await t.handler.execute(new StartTrialCommand(organizationId));

    expect(t.subscriptionCommandRepo.create).not.toHaveBeenCalled();
  });
});
