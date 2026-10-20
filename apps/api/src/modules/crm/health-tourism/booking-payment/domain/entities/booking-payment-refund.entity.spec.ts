import { Money } from '@src/domain/value-objects/money.vo';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { BookingPaymentRefund } from './booking-payment-refund.entity';
import {
  BookingPaymentRefundCurrencyNotSupportedException,
  BookingPaymentRefundInvalidRefundedAtException,
  BookingPaymentRefundNotResolvableException,
  BookingPaymentRefundNotRetryableException,
  BookingPaymentRefundSettleConflictException,
} from '../exceptions/booking-payment-refund.exceptions';
import { BookingPaymentRefundResolvedEvent } from '../events/booking-payment-refund.events';
import { BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES } from '../constants/booking-payment-refund.constant';

const UUIDS = {
  bp: '33333333-3333-4333-8333-333333333333',
  clinic: '00000000-0000-4000-8000-000000000002',
  org: '00000000-0000-4000-8000-000000000001',
};

const NOTE = 'iyzico panelinden iade satırı doğrulandı';

function newRefund(
  overrides: Partial<Parameters<typeof BookingPaymentRefund.request>[0]> = {}
) {
  return BookingPaymentRefund.request({
    bookingPaymentId: UUIDS.bp,
    clinicId: UUIDS.clinic,
    organizationId: UUIDS.org,
    kind: 'CANCELLATION',
    provider: 'IYZICO',
    chargeProviderRef: 'ptx-1',
    amount: Money.fromTrusted('1000.00', 'TRY'),
    ...overrides,
  });
}

/** Satırı geçmişte talep edilmiş gibi kurar (bayatlık için). */
function agedPending(minutesAgo: number) {
  const refund = newRefund();
  const data = refund.toPersistence();
  return new BookingPaymentRefund({
    ...data,
    requestedAt: DateTimeManager.subtractMinutes(
      DateTimeManager.create(),
      minutesAgo
    ),
  });
}

describe('BookingPaymentRefund', () => {
  describe('request', () => {
    it('PENDING, ilk girişim, anahtar = id:1', () => {
      const refund = newRefund();

      expect(refund.status).toBe('PENDING');
      expect(refund.attemptCount).toBe(1);
      expect(refund.origin).toBe('LIVE');
      expect(refund.idempotencyKey).toBe(`${refund.id.value}:1`);
      expect(refund.requestedAt).not.toBeNull();
    });

    it('iyzico TRY dışında reddedilir', () => {
      expect(() =>
        newRefund({ amount: Money.fromTrusted('10.00', 'EUR') })
      ).toThrow(BookingPaymentRefundCurrencyNotSupportedException);
    });

    it('Stripe EUR kabul edilir', () => {
      const refund = newRefund({
        provider: 'STRIPE',
        amount: Money.fromTrusted('10.00', 'EUR'),
      });
      expect(refund.amount.currency).toBe('EUR');
    });
  });

  describe('sağlayıcı sonucu (settle)', () => {
    it('onay → CONFIRMED, refundedAt ve ref dolar', () => {
      const refund = newRefund();

      refund.markConfirmedByProvider({ attempt: 1, providerRefundRef: 'h-1' });

      expect(refund.status).toBe('CONFIRMED');
      expect(refund.refundedAt).not.toBeNull();
      expect(refund.providerRefundRef).toBe('h-1');
    });

    it('ret → FAILED + neden', () => {
      const refund = newRefund();

      refund.markRejectedByProvider({
        attempt: 1,
        failureReason: 'reddedildi',
      });

      expect(refund.status).toBe('FAILED');
      expect(refund.failureReason).toBe('reddedildi');
    });

    it('bilinmiyor → UNCONFIRMED', () => {
      const refund = newRefund();

      refund.markUnconfirmed({ attempt: 1, failureReason: 'ETIMEDOUT' });

      expect(refund.status).toBe('UNCONFIRMED');
    });

    it('PENDING değilken settle reddedilir (araya girmiş akış ezilmez)', () => {
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });

      expect(() =>
        refund.markConfirmedByProvider({ attempt: 1, providerRefundRef: null })
      ).toThrow(BookingPaymentRefundSettleConflictException);
    });

    it('başka girişimin sonucu yazılamaz', () => {
      const refund = newRefund();

      expect(() =>
        refund.markConfirmedByProvider({ attempt: 2, providerRefundRef: null })
      ).toThrow(BookingPaymentRefundSettleConflictException);
    });
  });

  describe('countsTowardsReturned (tavan, kural 17)', () => {
    it.each([
      ['PENDING', true],
      ['UNCONFIRMED', true],
      ['CONFIRMED', true],
      ['FAILED', false],
    ])('%s → %s', (status, expected) => {
      const refund = newRefund();
      const data = refund.toPersistence();
      const withStatus = new BookingPaymentRefund({
        ...data,
        status: status as never,
        refundedAt: status === 'CONFIRMED' ? new Date() : null,
        failureReason: status === 'FAILED' ? 'x' : null,
      });

      expect(withStatus.countsTowardsReturned).toBe(expected);
    });
  });

  describe('elle çözüm', () => {
    it('taze PENDING çözülemez (çağrı sürüyor olabilir)', () => {
      const refund = newRefund();

      expect(() =>
        refund.resolve({
          outcome: 'NOT_REFUNDED',
          resolvedById: 'u-1',
          note: NOTE,
        })
      ).toThrow(BookingPaymentRefundNotResolvableException);
    });

    it('bayat PENDING çözülebilir', () => {
      const refund = agedPending(
        BOOKING_PAYMENT_REFUND_STALE_AFTER_MINUTES + 1
      );
      expect(refund.isStalePending()).toBe(true);

      refund.resolve({
        outcome: 'NOT_REFUNDED',
        resolvedById: 'u-1',
        note: NOTE,
      });

      expect(refund.status).toBe('FAILED');
    });

    it('CONFIRMED: refundedAt zorunlu ve talepten önce olamaz', () => {
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });

      expect(() =>
        refund.resolve({
          outcome: 'CONFIRMED',
          resolvedById: 'u-1',
          note: NOTE,
        })
      ).toThrow(BookingPaymentRefundInvalidRefundedAtException);
      expect(() =>
        refund.resolve({
          outcome: 'CONFIRMED',
          resolvedById: 'u-1',
          note: NOTE,
          refundedAt: DateTimeManager.subtractDays(DateTimeManager.create(), 1),
        })
      ).toThrow(BookingPaymentRefundInvalidRefundedAtException);
    });

    it('CONFIRMED: kalıcı damga + audit olayı', () => {
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });

      refund.resolve({
        outcome: 'CONFIRMED',
        resolvedById: 'u-1',
        note: NOTE,
        refundedAt: DateTimeManager.create(),
        providerRefundRef: 'h-9',
      });

      expect(refund.status).toBe('CONFIRMED');
      expect(refund.resolution).toBe('CONFIRMED');
      expect(refund.resolvedById).toBe('u-1');
      expect(refund.resolvedAt).not.toBeNull();
      expect(refund.resolutionNote).toBe(NOTE);
      expect(refund.providerRefundRef).toBe('h-9');
      const events = refund.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(BookingPaymentRefundResolvedEvent);
      expect(events[0].log).toMatchObject({
        actorId: 'u-1',
        details: expect.objectContaining({ outcome: 'CONFIRMED', note: NOTE }),
      });
    });

    it('CONFIRMED sondur: tekrar çözülemez', () => {
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });
      refund.resolve({
        outcome: 'CONFIRMED',
        resolvedById: 'u-1',
        note: NOTE,
        refundedAt: DateTimeManager.create(),
      });

      expect(() =>
        refund.resolve({
          outcome: 'NOT_REFUNDED',
          resolvedById: 'u-2',
          note: NOTE,
        })
      ).toThrow(BookingPaymentRefundNotResolvableException);
    });
  });

  describe('retry', () => {
    it('yalnız FAILED yeniden denenir; girişim artar, anahtar değişir', () => {
      const refund = newRefund();
      refund.markRejectedByProvider({ attempt: 1, failureReason: 'ret' });
      const firstKey = refund.idempotencyKey;

      refund.retry('u-1');

      expect(refund.status).toBe('PENDING');
      expect(refund.attemptCount).toBe(2);
      expect(refund.idempotencyKey).not.toBe(firstKey);
      expect(refund.idempotencyKey).toBe(`${refund.id.value}:2`);
    });

    it('UNCONFIRMED otomatik/elle retry ile açılamaz (çift iade riski)', () => {
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });

      expect(() => refund.retry('u-1')).toThrow(
        BookingPaymentRefundNotRetryableException
      );
    });

    it('NOT_REFUNDED kararı sonrası FAILED → retry açılır, eski karar damgası temizlenir', () => {
      const refund = newRefund();
      refund.markUnconfirmed({ attempt: 1, failureReason: 'x' });
      refund.resolve({
        outcome: 'NOT_REFUNDED',
        resolvedById: 'u-1',
        note: NOTE,
      });

      refund.retry('u-2');

      expect(refund.status).toBe('PENDING');
      expect(refund.resolution).toBeNull();
      expect(refund.resolvedById).toBeNull();
    });
  });

  it('toPersistence tüm alanları taşır (round-trip)', () => {
    const refund = newRefund({ reason: 'iptal', requestedById: 'u-1' });
    const roundTrip = new BookingPaymentRefund(refund.toPersistence());

    expect(roundTrip.toPersistence()).toEqual(refund.toPersistence());
    expect(BookingPaymentRefundResolvedEvent.NAME).toBe(
      'booking-payment-refund.resolved'
    );
  });
});
