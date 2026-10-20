import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { FindUnresolvedBookingPaymentRefundsHandler } from './find-unresolved-booking-payment-refunds.handler';
import { FindUnresolvedBookingPaymentRefundsQuery } from './find-unresolved-booking-payment-refunds.query';

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  bookingPaymentId: 'bp-1',
  clinicId: 'c-1',
  kind: 'CANCELLATION',
  origin: 'LIVE',
  provider: 'IYZICO',
  chargeProviderRef: 'ptx-1',
  amount: { toFixed: () => '100.00' },
  currency: 'TRY',
  status: 'UNCONFIRMED',
  attemptCount: 2,
  failureReason: 'ETIMEDOUT',
  requestedAt: DateTimeManager.create(),
  ...over,
});

describe('FindUnresolvedBookingPaymentRefundsHandler', () => {
  const ctx = { actor: {}, source: 'WEB' } as never;
  const pagination = { page: 1, limit: 20, skip: 0, take: 20 } as never;

  const build = (rows: unknown[]) => {
    const orThrow = jest.fn();
    const handler = new FindUnresolvedBookingPaymentRefundsHandler(
      {
        findUnresolved: jest.fn(async () => ({
          items: rows,
          total: rows.length,
        })),
      } as never,
      { resolve: jest.fn(async () => ({ clinicId: 'platform' })) } as never,
      {
        finance: jest.fn(() => ({
          evaluator: { check: jest.fn(() => ({ orThrow })) },
          policy: {
            getSerializationOptions: jest.fn(() => ({
              isGroupActive: true,
              groups: ['ADMIN'],
            })),
          },
        })),
      } as never
    );
    return { handler, orThrow };
  };

  const run = (handler: FindUnresolvedBookingPaymentRefundsHandler) =>
    handler.execute(
      new FindUnresolvedBookingPaymentRefundsQuery({
        filter: {},
        pagination,
        ctx,
      })
    );

  it('yetki platform kiracısı üzerinden denetlenir', async () => {
    const { handler, orThrow } = build([]);

    await run(handler);

    expect(orThrow).toHaveBeenCalledWith(
      'health-tourism.booking-payment-refund.list-unresolved'
    );
  });

  it('idempotency anahtarı id:girişim olarak türetilir (panelde aranan anahtar)', async () => {
    const { handler } = build([row()]);

    const { data } = await run(handler);

    expect(data[0].idempotencyKey).toBe('r-1:2');
    expect(data[0].amount).toBe('100.00');
  });

  it('bayat PENDING işaretlenir, taze PENDING işaretlenmez', async () => {
    const old = DateTimeManager.subtractMinutes(DateTimeManager.create(), 60);
    const { handler } = build([
      row({ id: 'old', status: 'PENDING', requestedAt: old }),
      row({
        id: 'fresh',
        status: 'PENDING',
        requestedAt: DateTimeManager.create(),
      }),
      row({ id: 'unconf', status: 'UNCONFIRMED' }),
    ]);

    const { data } = await run(handler);

    expect(data.map((d) => [d.id, d.stale])).toEqual([
      ['old', true],
      ['fresh', false],
      ['unconf', false],
    ]);
  });
});
