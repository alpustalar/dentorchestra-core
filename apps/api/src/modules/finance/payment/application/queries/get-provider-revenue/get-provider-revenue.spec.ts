import { Decimal } from 'decimal.js';
import { GetProviderRevenueHandler } from './get-provider-revenue.handler';
import { GetProviderRevenueQuery } from './get-provider-revenue.query';
import { LogSource } from '@src/domain/constants/log-action.constant';

describe('GetProviderRevenueHandler', () => {
  const clinicId = 'clinic-1';
  const ctx = {
    actor: { userId: 'u1', source: LogSource.WEB },
    source: 'API',
  } as never;

  const make = (rows: unknown[]) => {
    const paymentQueryRepo = {
      providerRevenue: jest.fn().mockResolvedValue(rows),
    };
    const policyFactory = {
      finance: () => ({
        evaluator: { check: () => ({ orThrow: jest.fn() }) },
        policy: { getSerializationOptions: () => ({}) },
      }),
    };
    return new GetProviderRevenueHandler(
      paymentQueryRepo as never,
      policyFactory as never
    );
  };

  it('ciro hekim + para birimi kırılımında toplanır', async () => {
    const handler = make([
      { providerId: 'dr-1', amount: new Decimal('1000'), currency: 'TRY' },
      { providerId: 'dr-1', amount: new Decimal('500'), currency: 'TRY' },
      { providerId: 'dr-1', amount: new Decimal('300'), currency: 'EUR' },
      { providerId: null, amount: new Decimal('100'), currency: 'TRY' },
    ]);

    const { data } = await handler.execute(
      new GetProviderRevenueQuery(clinicId, ctx)
    );

    const tryLine = data.lines.find(
      (l) => l.providerId === 'dr-1' && l.currency === 'TRY'
    );
    expect(tryLine?.collected).toBe('1500.00');
    expect(tryLine?.count).toBe(2);
    expect(
      data.lines.find((l) => l.providerId === 'dr-1' && l.currency === 'EUR')
        ?.collected
    ).toBe('300.00');

    // Genel toplam da para birimi başına: 1.600 TRY + 300 EUR tek sayıya
    // toplanmaz.
    const totals = Object.fromEntries(
      data.totals.map((t) => [t.currency, t.collected])
    );
    expect(totals).toEqual({ TRY: '1600.00', EUR: '300.00' });
  });

  it('atanmamış hekim satırı her zaman en altta kalır', async () => {
    const handler = make([
      { providerId: null, amount: new Decimal('9000'), currency: 'TRY' },
      { providerId: 'dr-1', amount: new Decimal('10'), currency: 'TRY' },
    ]);

    const { data } = await handler.execute(
      new GetProviderRevenueQuery(clinicId, ctx)
    );

    expect(data.lines.map((l) => l.providerId)).toEqual(['dr-1', null]);
  });
});
