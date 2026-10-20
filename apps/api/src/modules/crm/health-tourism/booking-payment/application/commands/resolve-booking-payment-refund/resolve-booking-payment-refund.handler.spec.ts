import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import {
  BookingPaymentRefundNotFoundException,
  BookingPaymentRefundNotResolvableException,
  BookingPaymentRefundReversalAlreadyRecordedException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { ResolveBookingPaymentRefundHandler } from './resolve-booking-payment-refund.handler';
import { ResolveBookingPaymentRefundCommand } from './resolve-booking-payment-refund.command';

const IDS = {
  bp: '33333333-3333-4333-8333-333333333333',
  clinic: '00000000-0000-4000-8000-000000000002',
  org: '00000000-0000-4000-8000-000000000001',
};

const NOTE = 'iyzico panelinden iade satırı doğrulandı';

const unconfirmed = (
  kind:
    | 'CANCELLATION'
    | 'BOOKING_FAILED'
    | 'UNCLAIMED_CHARGE' = 'UNCLAIMED_CHARGE'
) => {
  const refund = BookingPaymentRefund.request({
    bookingPaymentId: IDS.bp,
    clinicId: IDS.clinic,
    organizationId: IDS.org,
    kind,
    provider: 'IYZICO',
    chargeProviderRef: 'ptx-7',
    amount: Money.fromTrusted('500.00', 'TRY'),
  });
  refund.markUnconfirmed({ attempt: 1, failureReason: 'ETIMEDOUT' });
  return refund;
};

describe('ResolveBookingPaymentRefundHandler', () => {
  const ctx = { actor: { userId: 'admin-1' }, source: 'WEB' } as never;

  const build = (refund: BookingPaymentRefund | null) => {
    let depth = 0;
    const order: string[] = [];
    const depthAt: Record<string, number> = {};
    const mark = (label: string) => {
      order.push(label);
      depthAt[label] = depth;
    };

    const bp = {
      status: 'FAILED',
      markRefunded: jest.fn(),
    };

    const platformTenant = {
      resolve: jest.fn(async () => ({
        clinicId: IDS.clinic,
        organizationId: IDS.org,
      })),
    };
    const policyFactory = {
      finance: jest.fn(() => ({
        evaluator: {
          check: jest.fn(() => ({
            orThrow: () => mark('policy'),
          })),
        },
      })),
    };
    const periodGate = {
      assertPeriodNotSealedAt: jest.fn(async () => mark('periodGate')),
    };
    const presenceGuard = {
      isRecorded: jest.fn(async () => {
        mark('presence');
        return false;
      }),
    };
    const bookingPaymentRepo = {
      findByIdForUpdate: jest.fn(async () => {
        mark('lock:bp');
        return bp;
      }),
      update: jest.fn(async (e) => {
        mark('update:bp');
        return e;
      }),
    };
    const refundRepo = {
      findById: jest.fn(async () => refund),
      findByIdForUpdate: jest.fn(async () => {
        mark('lock:refund');
        return refund;
      }),
      update: jest.fn(async (e) => {
        mark('update:refund');
        return e;
      }),
    };
    const platformLedger = {
      reversalDedupeKey: jest.fn(
        () => 'platform-returnable-charge-refunded:IYZICO:ptx-7'
      ),
      bridgeConfirmedRefundBestEffort: jest.fn(async () => mark('bridge')),
    };
    const txManager = {
      outboxRun: jest.fn(async (fn: () => Promise<unknown>) => {
        depth++;
        try {
          return await fn();
        } finally {
          depth--;
        }
      }),
    };

    const handler = new ResolveBookingPaymentRefundHandler(
      platformTenant as never,
      policyFactory as never,
      periodGate as never,
      presenceGuard as never,
      bookingPaymentRepo as never,
      refundRepo as never,
      platformLedger as never,
      txManager as never
    );

    return {
      handler,
      bp,
      order,
      depthAt,
      periodGate,
      presenceGuard,
      bookingPaymentRepo,
      refundRepo,
      platformLedger,
    };
  };

  const confirmed = (refundedAt = DateTimeManager.create()) =>
    new ResolveBookingPaymentRefundCommand({
      refundId: 'r-1',
      data: { outcome: 'CONFIRMED', refundedAt, note: NOTE },
      ctx,
    });

  const notRefunded = () =>
    new ResolveBookingPaymentRefundCommand({
      refundId: 'r-1',
      data: { outcome: 'NOT_REFUNDED', note: NOTE },
      ctx,
    });

  it('CONFIRMED kapı sırası: yetki → bp kilidi → iade kilidi → dönem kapısı → güncelle → (commit sonrası) köprü', async () => {
    const { handler, order, depthAt } = build(unconfirmed());

    const response = await handler.execute(confirmed());

    expect(response.status).toBe('CONFIRMED');
    expect(order).toEqual([
      'policy',
      'lock:bp',
      'lock:refund',
      'periodGate',
      'update:refund',
      'bridge',
    ]);
    // Tümü outboxRun derinliğinde; köprü commit SONRASI (kararı geri almaz).
    expect(depthAt['lock:bp']).toBe(1);
    expect(depthAt.periodGate).toBe(1);
    expect(depthAt['update:refund']).toBe(1);
    expect(depthAt.bridge).toBe(0);
  });

  it('CONFIRMED: dönem kapısı iadenin GERÇEKLEŞTİĞİ güne bakar (kural 1)', async () => {
    const { handler, periodGate } = build(unconfirmed());
    const refundedAt = DateTimeManager.create();

    await handler.execute(confirmed(refundedAt));

    expect(periodGate.assertPeriodNotSealedAt).toHaveBeenCalledWith({
      clinicId: IDS.clinic,
      date: refundedAt,
    });
  });

  it('CONFIRMED: mühürlü döneme düşen iade reddedilir, satır değişmez', async () => {
    const refund = unconfirmed();
    const { handler, periodGate, refundRepo } = build(refund);
    periodGate.assertPeriodNotSealedAt.mockRejectedValue(
      new Error('dönem mühürlü')
    );

    await expect(handler.execute(confirmed())).rejects.toThrow('dönem mühürlü');
    expect(refundRepo.update).not.toHaveBeenCalled();
    expect(refund.status).toBe('UNCONFIRMED');
  });

  it('NOT_REFUNDED: dönem kapısı değil, ters fişin zaten yazılı olup olmadığı sorulur', async () => {
    const { handler, order, presenceGuard, periodGate } = build(unconfirmed());

    const response = await handler.execute(notRefunded());

    expect(response.status).toBe('FAILED');
    expect(presenceGuard.isRecorded).toHaveBeenCalledWith({
      clinicId: IDS.clinic,
      dedupeKey: 'platform-returnable-charge-refunded:IYZICO:ptx-7',
    });
    expect(periodGate.assertPeriodNotSealedAt).not.toHaveBeenCalled();
    expect(order).not.toContain('bridge');
  });

  it('NOT_REFUNDED: ters fiş zaten yazılıysa reddedilir, hiçbir şey güncellenmez', async () => {
    const { handler, presenceGuard, refundRepo } = build(
      unconfirmed('CANCELLATION')
    );
    presenceGuard.isRecorded.mockResolvedValue(true);

    await expect(handler.execute(notRefunded())).rejects.toBeInstanceOf(
      BookingPaymentRefundReversalAlreadyRecordedException
    );
    expect(refundRepo.update).not.toHaveBeenCalled();
  });

  it('taze PENDING çözülemez ve dönem kapısı bile çağrılmaz', async () => {
    const fresh = BookingPaymentRefund.request({
      bookingPaymentId: IDS.bp,
      clinicId: IDS.clinic,
      organizationId: IDS.org,
      kind: 'UNCLAIMED_CHARGE',
      provider: 'IYZICO',
      chargeProviderRef: 'ptx-8',
      amount: Money.fromTrusted('10.00', 'TRY'),
    });
    const { handler, periodGate, refundRepo } = build(fresh);

    await expect(handler.execute(confirmed())).rejects.toBeInstanceOf(
      BookingPaymentRefundNotResolvableException
    );
    expect(periodGate.assertPeriodNotSealedAt).not.toHaveBeenCalled();
    expect(refundRepo.update).not.toHaveBeenCalled();
  });

  it('zaten CONFIRMED olan satır tekrar çözülemez (sondur)', async () => {
    const refund = unconfirmed();
    refund.resolve({
      outcome: 'CONFIRMED',
      resolvedById: 'u',
      note: NOTE,
      refundedAt: DateTimeManager.create(),
    });
    const { handler } = build(refund);

    await expect(handler.execute(confirmed())).rejects.toBeInstanceOf(
      BookingPaymentRefundNotResolvableException
    );
  });

  it('BOOKING_FAILED + CONFIRMED: rezervasyon kaydı da REFUNDED olur', async () => {
    const { handler, bp, bookingPaymentRepo } = build(
      unconfirmed('BOOKING_FAILED')
    );

    await handler.execute(confirmed());

    expect(bp.markRefunded).toHaveBeenCalledTimes(1);
    expect(bookingPaymentRepo.update).toHaveBeenCalledTimes(1);
  });

  it('çift çekim + CONFIRMED: rezervasyon kaydına dokunulmaz', async () => {
    const { handler, bp, bookingPaymentRepo } = build(
      unconfirmed('UNCLAIMED_CHARGE')
    );

    await handler.execute(confirmed());

    expect(bp.markRefunded).not.toHaveBeenCalled();
    expect(bookingPaymentRepo.update).not.toHaveBeenCalled();
  });

  it('kalıcı damga: kim kapattı satıra yazılır', async () => {
    const refund = unconfirmed();
    const { handler } = build(refund);

    await handler.execute(confirmed());

    expect(refund.resolvedById).toBe('admin-1');
    expect(refund.resolution).toBe('CONFIRMED');
    expect(refund.resolutionNote).toBe(NOTE);
  });

  it('iade kaydı yoksa NotFound (hiçbir kapı çalışmaz)', async () => {
    const { handler, bookingPaymentRepo } = build(null);

    await expect(handler.execute(confirmed())).rejects.toBeInstanceOf(
      BookingPaymentRefundNotFoundException
    );
    expect(bookingPaymentRepo.findByIdForUpdate).not.toHaveBeenCalled();
  });
});
