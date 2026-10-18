import { GetTenantEntitlementsHandler } from './get-tenant-entitlements.handler';
import { GetTenantEntitlementsQuery } from './get-tenant-entitlements.query';
import { ISubscriptionQueryRepository } from '@modules/platform/subscription/domain/repositories/subscription/subscription.query.repository';
import { IPlanQueryRepository } from '@modules/platform/subscription/domain/repositories/plan/plan.query.repository';
import { EntitlementSource } from '@modules/platform/subscription/domain/contracts';
import { randomUUID } from 'crypto';

describe('GetTenantEntitlementsHandler', () => {
  const organizationId = randomUUID();

  const build = (source: EntitlementSource | null) => {
    const subscriptionQueryRepo = {
      findEntitlementSource: jest.fn().mockResolvedValue(source),
    } as unknown as ISubscriptionQueryRepository;

    const planQueryRepo = {
      findByPlanIdWithModules: jest.fn().mockResolvedValue({
        modules: [{ key: 'e_invoice' }, { key: 'pos_integration' }],
      }),
    } as unknown as IPlanQueryRepository;

    const handler = new GetTenantEntitlementsHandler(
      subscriptionQueryRepo,
      planQueryRepo
    );
    return { handler, planQueryRepo };
  };

  const run = (t: { handler: GetTenantEntitlementsHandler }) =>
    t.handler.execute(new GetTenantEntitlementsQuery(organizationId));

  it('abonelik yok → boş entitlement (active:false)', async () => {
    const t = build(null);
    const { data } = await run(t);
    expect(data.active).toBe(false);
    expect(data.modules).toEqual([]);
    expect(data.planId).toBeNull();
  });

  it('ACTIVE plan + eklenti → plan modülleri ∪ eklenti (tekil)', async () => {
    const t = build({
      status: 'ACTIVE',
      trialEndsAt: null,
      currentPeriodEnd: null,
      planId: 'BASIC',
      addOnModuleKeys: ['crm'],
    });
    const { data } = await run(t);
    expect(data.active).toBe(true);
    expect(new Set(data.modules)).toEqual(
      new Set(['e_invoice', 'pos_integration', 'crm'])
    );
  });

  it('geçerli deneme (FREE_TRIAL) → BASIC bundle modülleri açılır', async () => {
    const t = build({
      status: 'ACTIVE',
      trialEndsAt: new Date(Date.now() + 5 * 86400000),
      currentPeriodEnd: null,
      planId: 'FREE_TRIAL',
      addOnModuleKeys: [],
    });
    const { data } = await run(t);
    expect(data.active).toBe(true);
    expect(new Set(data.modules)).toEqual(
      new Set(['e_invoice', 'pos_integration'])
    );
    // Efektif plan BASIC ile çözülmeli.
    expect(t.planQueryRepo.findByPlanIdWithModules).toHaveBeenCalledWith(
      'BASIC'
    );
  });

  it('EXPIRED → active:false, modül verilmez', async () => {
    const t = build({
      status: 'EXPIRED',
      trialEndsAt: null,
      currentPeriodEnd: new Date('2020-01-01'),
      planId: 'BASIC',
      addOnModuleKeys: ['crm'],
    });
    const { data } = await run(t);
    expect(data.active).toBe(false);
    expect(data.modules).toEqual([]);
    expect(data.planId).toBe('BASIC'); // görüntü için korunur
  });
});
