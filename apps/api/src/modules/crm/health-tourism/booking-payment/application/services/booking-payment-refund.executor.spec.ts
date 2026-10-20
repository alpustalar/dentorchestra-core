import { Money } from '@src/domain/value-objects/money.vo';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundExecutor } from './booking-payment-refund.executor';

const IDS = {
  bp: '33333333-3333-4333-8333-333333333333',
  clinic: '00000000-0000-4000-8000-000000000002',
  org: '00000000-0000-4000-8000-000000000001',
};

const newRefund = (
  kind: 'CANCELLATION' | 'BOOKING_FAILED' | 'UNCLAIMED_CHARGE'
) =>
  BookingPaymentRefund.request({
    bookingPaymentId: IDS.bp,
    clinicId: IDS.clinic,
    organizationId: IDS.org,
    kind,
    provider: 'IYZICO',
    chargeProviderRef: `ptx-${kind}`,
    amount: Money.fromTrusted('1000.00', 'TRY'),
    reason: 'test',
  });

describe('BookingPaymentRefundExecutor', () => {
  let calls: string[];
  let iyzicoLink: { refund: jest.Mock };
  let stripeLink: { refund: jest.Mock };
  let store: Map<string, BookingPaymentRefund>;
  let refundRepo: {
    findByIdForUpdate: jest.Mock;
    findById: jest.Mock;
    update: jest.Mock;
  };
  let bp: { paidAt: Date; markRefunded: jest.Mock };
  let bpRepo: {
    findById: jest.Mock;
    findByIdForUpdate: jest.Mock;
    update: jest.Mock;
  };
  let platformLedger: {
    isReturnableLedgerable: jest.Mock;
    recordReturnableBestEffort: jest.Mock;
    bridgeConfirmedRefundBestEffort: jest.Mock;
  };
  let criticalFailure: { publish: jest.Mock };
  let executor: BookingPaymentRefundExecutor;

  beforeEach(() => {
    calls = [];
    store = new Map();
    iyzicoLink = { refund: jest.fn() };
    stripeLink = { refund: jest.fn() };
    bp = { paidAt: new Date('2026-10-01T10:00:00Z'), markRefunded: jest.fn() };
    bpRepo = {
      findById: jest.fn(async () => bp),
      findByIdForUpdate: jest.fn(async () => {
        calls.push('lock:bp');
        return bp;
      }),
      update: jest.fn(async (e) => e),
    };
    refundRepo = {
      findById: jest.fn(async (id: string) => store.get(id) ?? null),
      findByIdForUpdate: jest.fn(async (id: string) => {
        calls.push('lock:refund');
        return store.get(id) ?? null;
      }),
      update: jest.fn(async (e: BookingPaymentRefund) => e),
    };
    platformLedger = {
      isReturnableLedgerable: jest.fn(
        (r: BookingPaymentRefund) => r.kind !== 'CANCELLATION'
      ),
      recordReturnableBestEffort: jest.fn(async () => {
        calls.push('ledger:received');
      }),
      bridgeConfirmedRefundBestEffort: jest.fn(async () => {
        calls.push('ledger:bridge');
      }),
    };
    criticalFailure = { publish: jest.fn() };
    executor = new BookingPaymentRefundExecutor(
      iyzicoLink as never,
      stripeLink as never,
      refundRepo as never,
      bpRepo as never,
      platformLedger as never,
      criticalFailure as never,
      { run: (fn: () => Promise<unknown>) => fn() } as never
    );
  });

  const run = async (kind: Parameters<typeof newRefund>[0]) => {
    const refund = newRefund(kind);
    store.set(refund.id.value, refund);
    const execution = await executor.execute(refund);
    return { refund, execution };
  };

  it('başarılı: CONFIRMED, tipli idempotency anahtarı sağlayıcıya gider, köprü çalışır', async () => {
    iyzicoLink.refund.mockImplementation(async () => {
      calls.push('provider');
      return { outcome: 'SUCCEEDED', providerRefundRef: 'h-1' };
    });

    const { refund, execution } = await run('CANCELLATION');

    expect(execution).toMatchObject({
      status: 'CONFIRMED',
      settleConflict: false,
    });
    expect(iyzicoLink.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: `${refund.id.value}:1`,
        amount: 1000,
      })
    );
    expect(platformLedger.bridgeConfirmedRefundBestEffort).toHaveBeenCalled();
    expect(criticalFailure.publish).not.toHaveBeenCalled();
  });

  it('sağlayıcı REDDETTİ: FAILED, CRITICAL, ters fiş/köprü YOK, fırlatmaz', async () => {
    iyzicoLink.refund.mockResolvedValue({
      outcome: 'REJECTED',
      errorCode: '5',
      errorMessage: 'iade edilemez',
    });

    const { execution } = await run('CANCELLATION');

    expect(execution.status).toBe('FAILED');
    expect(
      platformLedger.bridgeConfirmedRefundBestEffort
    ).not.toHaveBeenCalled();
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'CRITICAL' })
    );
  });

  it('taşıma hatası (zaman aşımı): UNCONFIRMED — "olmadı" değil "bilinmiyor"; ters fiş YOK', async () => {
    iyzicoLink.refund.mockRejectedValue(new Error('ETIMEDOUT'));

    const { execution } = await run('UNCLAIMED_CHARGE');

    expect(execution.status).toBe('UNCONFIRMED');
    expect(
      platformLedger.bridgeConfirmedRefundBestEffort
    ).not.toHaveBeenCalled();
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: expect.stringContaining('booking-refund-unconfirmed:'),
      })
    );
  });

  it('336 açılışı (RECEIVED) sağlayıcı çağrısından ÖNCE; iade kilidi sırası bp → iade', async () => {
    iyzicoLink.refund.mockImplementation(async () => {
      calls.push('provider');
      return { outcome: 'SUCCEEDED', providerRefundRef: null };
    });

    await run('UNCLAIMED_CHARGE');

    expect(calls).toEqual([
      'ledger:received',
      'provider',
      'lock:bp',
      'lock:refund',
      'ledger:bridge',
    ]);
  });

  it('iptal iadesi 336 açmaz (kendi tahsilatı REFUNDED fişine gider)', async () => {
    iyzicoLink.refund.mockResolvedValue({
      outcome: 'SUCCEEDED',
      providerRefundRef: null,
    });

    await run('CANCELLATION');

    expect(platformLedger.recordReturnableBestEffort).not.toHaveBeenCalled();
  });

  it('BOOKING_FAILED onaylanınca rezervasyon kaydı REFUNDED olur; reddedilirse dokunulmaz', async () => {
    iyzicoLink.refund.mockResolvedValue({
      outcome: 'SUCCEEDED',
      providerRefundRef: null,
    });
    await run('BOOKING_FAILED');
    expect(bp.markRefunded).toHaveBeenCalledTimes(1);
    expect(bpRepo.update).toHaveBeenCalledTimes(1);

    bp.markRefunded.mockClear();
    bpRepo.update.mockClear();
    iyzicoLink.refund.mockResolvedValue({
      outcome: 'REJECTED',
      errorCode: null,
      errorMessage: 'x',
    });
    await run('BOOKING_FAILED');
    expect(bp.markRefunded).not.toHaveBeenCalled();
    expect(bpRepo.update).not.toHaveBeenCalled();
  });

  it('araya başka akış girdiyse sonuç yazılmaz, CRITICAL basılır (kural 3)', async () => {
    iyzicoLink.refund.mockImplementation(async () => {
      // Sağlayıcı çağrısı sürerken operatör satırı elle kapattı.
      const locked = [...store.values()][0];
      locked.markUnconfirmed({ attempt: 1, failureReason: 'elle' });
      return { outcome: 'SUCCEEDED', providerRefundRef: 'h-1' };
    });

    const { execution } = await run('UNCLAIMED_CHARGE');

    expect(execution.settleConflict).toBe(true);
    expect(refundRepo.update).not.toHaveBeenCalled();
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: expect.stringContaining('booking-refund-settle-conflict:'),
      })
    );
  });

  it('Stripe iadesi Stripe adaptörüne gider', async () => {
    const refund = BookingPaymentRefund.request({
      bookingPaymentId: IDS.bp,
      clinicId: IDS.clinic,
      organizationId: IDS.org,
      kind: 'CANCELLATION',
      provider: 'STRIPE',
      chargeProviderRef: 'pi_1',
      amount: Money.fromTrusted('10.00', 'EUR'),
    });
    store.set(refund.id.value, refund);
    stripeLink.refund.mockResolvedValue({
      outcome: 'SUCCEEDED',
      providerRefundRef: 're_1',
    });

    await executor.execute(refund);

    expect(stripeLink.refund).toHaveBeenCalled();
    expect(iyzicoLink.refund).not.toHaveBeenCalled();
  });
});
