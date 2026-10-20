import { Money } from '@src/domain/value-objects/money.vo';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import {
  BookingPaymentRefundNotFoundException,
  BookingPaymentRefundNotRetryableException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { CollectionUnderChargebackException } from '@modules/finance/bank/domain/exceptions/bank.exceptions';
import { RetryBookingPaymentRefundHandler } from './retry-booking-payment-refund.handler';
import { RetryBookingPaymentRefundCommand } from './retry-booking-payment-refund.command';

const IDS = {
  bp: '33333333-3333-4333-8333-333333333333',
  clinic: '00000000-0000-4000-8000-000000000002',
  org: '00000000-0000-4000-8000-000000000001',
};

const refundIn = (state: 'FAILED' | 'UNCONFIRMED') => {
  const refund = BookingPaymentRefund.request({
    bookingPaymentId: IDS.bp,
    clinicId: IDS.clinic,
    organizationId: IDS.org,
    kind: 'CANCELLATION',
    provider: 'IYZICO',
    chargeProviderRef: 'ptx-3',
    amount: Money.fromTrusted('900.00', 'TRY'),
  });
  if (state === 'FAILED') {
    refund.markRejectedByProvider({ attempt: 1, failureReason: 'ret' });
  } else {
    refund.markUnconfirmed({ attempt: 1, failureReason: 'ETIMEDOUT' });
  }
  return refund;
};

describe('RetryBookingPaymentRefundHandler', () => {
  const ctx = { actor: { userId: 'admin-1' }, source: 'WEB' } as never;

  const build = (
    refund: BookingPaymentRefund | null,
    guardError: Error | null = null
  ) => {
    let depth = 0;
    const depthAt: Record<string, number> = {};
    const order: string[] = [];
    const mark = (label: string) => {
      order.push(label);
      depthAt[label] = depth;
    };

    const refundRepo = {
      findById: jest.fn(async () => refund),
      findByIdForUpdate: jest.fn(async () => {
        mark('lock:refund');
        return refund;
      }),
      update: jest.fn(async (e) => {
        mark('update');
        return e;
      }),
    };
    const bookingPaymentRepo = {
      findByIdForUpdate: jest.fn(async () => {
        mark('lock:bp');
        return {};
      }),
    };
    const executor = {
      execute: jest.fn(async (r: BookingPaymentRefund) => {
        mark('executor');
        return {
          refundId: r.id.value,
          status: 'CONFIRMED',
          settleConflict: false,
        };
      }),
    };
    const exposureGuard = {
      assertReversalWithinCollection: jest.fn(async () => {
        mark('guard');
        if (guardError) throw guardError;
      }),
    };
    const handler = new RetryBookingPaymentRefundHandler(
      { resolve: jest.fn(async () => ({ clinicId: IDS.clinic })) } as never,
      {
        finance: jest.fn(() => ({
          evaluator: { check: jest.fn(() => ({ orThrow: jest.fn() })) },
        })),
      } as never,
      bookingPaymentRepo as never,
      refundRepo as never,
      exposureGuard as never,
      executor as never,
      {
        outboxRun: jest.fn(async (fn: () => Promise<unknown>) => {
          depth++;
          try {
            return await fn();
          } finally {
            depth--;
          }
        }),
      } as never
    );
    return { handler, order, depthAt, executor, refundRepo, exposureGuard };
  };

  it('FAILED yeniden açılır: girişim artar, yürütücü tx DIŞINDA çağrılır', async () => {
    const refund = refundIn('FAILED');
    const { handler, order, depthAt, executor } = build(refund);

    const response = await handler.execute(
      new RetryBookingPaymentRefundCommand('r-1', ctx)
    );

    expect(order).toEqual([
      'lock:bp',
      'lock:refund',
      'guard',
      'update',
      'executor',
    ]);
    expect(depthAt.update).toBe(1);
    expect(depthAt.executor).toBe(0);
    expect(refund.attemptCount).toBe(2);
    expect(executor.execute).toHaveBeenCalledWith(refund);
    expect(response.status).toBe('CONFIRMED');
  });

  it('UNCONFIRMED yeniden denenemez (çift iade riski) ve yürütücü çağrılmaz', async () => {
    const { handler, executor } = build(refundIn('UNCONFIRMED'));

    await expect(
      handler.execute(new RetryBookingPaymentRefundCommand('r-1', ctx))
    ).rejects.toBeInstanceOf(BookingPaymentRefundNotRetryableException);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('iade kaydı yoksa NotFound', async () => {
    const { handler } = build(null);

    await expect(
      handler.execute(new RetryBookingPaymentRefundCommand('r-1', ctx))
    ).rejects.toBeInstanceOf(BookingPaymentRefundNotFoundException);
  });

  it('aktif kart itirazı varken yeniden deneme REDDEDİLİR: satır FAILED kalır, yürütücü çağrılmaz', async () => {
    const refund = refundIn('FAILED');
    const { handler, executor, refundRepo } = build(
      refund,
      new CollectionUnderChargebackException({
        collected: '900.00',
        alreadyReversed: '0.00',
        activeChargebacks: '900.00',
        requested: '900.00',
      })
    );

    await expect(
      handler.execute(new RetryBookingPaymentRefundCommand('r-1', ctx))
    ).rejects.toBeInstanceOf(CollectionUnderChargebackException);

    expect(refund.status).toBe('FAILED');
    expect(refund.attemptCount).toBe(1);
    expect(refundRepo.update).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it('kapı booking-payment kaynağı ve satırın tutarıyla çağrılır', async () => {
    const refund = refundIn('FAILED');
    const { handler, exposureGuard } = build(refund);

    await handler.execute(new RetryBookingPaymentRefundCommand('r-1', ctx));

    const call = (
      exposureGuard.assertReversalWithinCollection.mock.calls as unknown as [
        Record<string, unknown>,
      ][]
    )[0][0];
    expect(call.sourceType).toBe('BOOKING_PAYMENT');
    expect(call.sourceId).toBe(refund.bookingPaymentId.value);
    expect(String(call.requestedAmount)).toBe('900');
  });
});
