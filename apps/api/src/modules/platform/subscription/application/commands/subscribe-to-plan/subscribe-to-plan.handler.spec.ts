import { Decimal } from 'decimal.js';
import { SubscribeToPlanHandler } from './subscribe-to-plan.handler';
import { SubscribeToPlanCommand } from './subscribe-to-plan.command';
import { Subscription } from '@modules/platform/subscription/domain/entities/subscription.entity';
import { SubscriptionItem } from '@modules/platform/subscription/domain/entities/subscription-item.entity';
import {
  SubscriptionAlreadyExistsException,
  SubscriptionClinicRequiredException,
} from '@modules/platform/subscription/domain/exceptions/subscription.exceptions';
import { ISubscriptionCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription/subscription.command.repository';
import { ISubscriptionItemCommandRepository } from '@modules/platform/subscription/domain/repositories/subscription-item/subscription-item.command.repository';
import { IPlanCommandRepository } from '@modules/platform/subscription/domain/repositories/plan/plan.command.repository';
import { IBillingAdapter } from '@modules/platform/subscription/infrastructure/adapters/billing-adapter.interface';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { randomUUID } from 'crypto';

describe('SubscribeToPlanHandler', () => {
  const organizationId = randomUUID();
  const clinicId = randomUUID();
  const buyer = {
    id: 'b1',
    name: 'Ada',
    surname: 'L',
    email: 'a@x.com',
    gsmNumber: '+90555',
    ip: '127.0.0.1',
  };

  const build = (params: {
    billingTarget: 'ORGANIZATION' | 'CLINIC';
    alreadyExists?: boolean;
  }) => {
    let createdSub: Subscription | undefined;
    let createdItem: SubscriptionItem | undefined;

    const subscriptionCommandRepo = {
      create: jest.fn(async (s: Subscription) => {
        createdSub = s;
        return s;
      }),
      // Guard iki kez sorulur: erken çıkış + yazma anındaki bağlayıcı kontrol.
      existsByOwner: jest.fn().mockResolvedValue(params.alreadyExists ?? false),
    } as unknown as ISubscriptionCommandRepository;

    const subscriptionItemCommandRepo = {
      create: jest.fn(async (i: SubscriptionItem) => {
        createdItem = i;
        return i;
      }),
    } as unknown as ISubscriptionItemCommandRepository;

    const planCommandRepo = {
      // Plan tanımı yok → command fiyatına düşer (mevcut testlerin davranışı korunur).
      findByPlanId: jest.fn().mockResolvedValue(null),
    } as unknown as IPlanCommandRepository;

    const billingAdapter = {
      initializePayment: jest.fn().mockResolvedValue({
        checkoutUrl: 'https://pay/checkout',
        conversationId: 'conv-123',
      }),
    } as unknown as IBillingAdapter;

    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: params.billingTarget }),
    } as unknown as TSQueryBus;

    const txManager = {
      outboxRun: jest.fn((cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    const handler = new SubscribeToPlanHandler(
      subscriptionCommandRepo,
      subscriptionItemCommandRepo,
      planCommandRepo,
      billingAdapter,
      queryBus,
      txManager
    );

    return {
      handler,
      billingAdapter,
      getCreatedSub: () => createdSub,
      getCreatedItem: () => createdItem,
    };
  };

  const cmd = (over: Partial<Record<string, unknown>> = {}) =>
    new SubscribeToPlanCommand({
      organizationId,
      planId: 'BASIC',
      priceAtPurchase: new Decimal(100),
      currency: 'TRY',
      actor: { userId: 'SYSTEM' } as never,
      buyer,
      ...over,
    });

  it('ORGANIZATION + ücretli plan: subscription (clinicId null, externalId=conversationId) + item + checkoutUrl', async () => {
    const t = build({ billingTarget: 'ORGANIZATION' });

    const res = await t.handler.execute(cmd());

    expect(res.checkoutUrl).toBe('https://pay/checkout');
    const sub = t.getCreatedSub()!;
    expect(sub.billingTarget).toBe('ORGANIZATION');
    expect(sub.clinicId).toBeNull();
    expect(sub.externalId).toBe('conv-123');
    expect(t.getCreatedItem()!.planId).toBe('BASIC');
    expect(res.subscriptionId).toBe(sub.id.value);
  });

  it('CLINIC hedef + clinicId verilmişse: clinic-billed subscription', async () => {
    const t = build({ billingTarget: 'CLINIC' });

    await t.handler.execute(cmd({ clinicId }));

    expect(t.getCreatedSub()!.clinicId?.value).toBe(clinicId);
  });

  it('CLINIC hedef ama clinicId yok → SubscriptionClinicRequiredException', async () => {
    const t = build({ billingTarget: 'CLINIC' });
    await expect(t.handler.execute(cmd())).rejects.toBeInstanceOf(
      SubscriptionClinicRequiredException
    );
  });

  it('FREE_TRIAL: ödeme başlatılmaz, checkoutUrl null', async () => {
    const t = build({ billingTarget: 'ORGANIZATION' });
    const res = await t.handler.execute(
      cmd({ planId: 'FREE_TRIAL', buyer: undefined })
    );
    expect(res.checkoutUrl).toBeNull();
    expect(t.billingAdapter.initializePayment).not.toHaveBeenCalled();
  });

  it('sahip zaten abone → SubscriptionAlreadyExistsException', async () => {
    const t = build({ billingTarget: 'ORGANIZATION', alreadyExists: true });
    await expect(t.handler.execute(cmd())).rejects.toBeInstanceOf(
      SubscriptionAlreadyExistsException
    );
  });
});
