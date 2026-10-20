import { BookingPaymentCollectionService } from './booking-payment-collection.service';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import {
  BookingPaymentNotChargeableException,
  BookingPaymentNotFoundException,
} from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { Money } from '@src/domain/value-objects/money.vo';

/**
 * Platform rezervasyon tahsilatının kilitli, geri götürülebilir tutarı (kural 17).
 * Bu servis itiraz açılışının tavanını besler: yanlış büyük dönerse aynı para iade + itiraz
 * olarak iki kez geri gider.
 */
describe('BookingPaymentCollectionService.lockAndGetReversibleAmount', () => {
  const intent: HotelBookingIntent = {
    type: 'HOTEL',
    hotelCode: 'H1',
    hotelName: 'Otel Bir',
    checkIn: '2026-07-01',
    checkOut: '2026-07-05',
    holderName: 'Ali',
    holderSurname: 'Veli',
    rooms: [{ rateKey: 'RK-1', paxes: [] }],
  };
  const props: CreateBookingPaymentProps = {
    bookingType: 'HOTEL',
    saleCurrency: 'EUR',
    saleAmount: 120,
    tryAmount: 4200,
    netAmount: 100,
    fxRate: 35,
    intent,
    clinicId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    patientId: '44444444-4444-4444-8444-444444444444',
    leadId: null,
    conversationId: 'conv-1',
  };

  const paid = (provider: 'IYZICO' | 'STRIPE' | null): BookingPayment => {
    const bp = BookingPayment.create(props);
    if (provider)
      bp.markPaid(provider, provider === 'IYZICO' ? 'tx_1' : 'pi_1');
    return bp;
  };

  const refundFor = (
    bp: BookingPayment,
    state: 'PENDING' | 'FAILED' | 'UNCONFIRMED' | 'CONFIRMED'
  ): BookingPaymentRefund => {
    const refund = BookingPaymentRefund.request({
      bookingPaymentId: bp.id.value,
      clinicId: bp.clinicId.value,
      organizationId: bp.organizationId.value,
      kind: 'CANCELLATION',
      provider: 'IYZICO',
      chargeProviderRef: 'tx_1',
      amount: Money.fromTrusted('4200.00', 'TRY'),
    });
    if (state === 'FAILED') {
      refund.markRejectedByProvider({ attempt: 1, failureReason: 'ret' });
    } else if (state === 'UNCONFIRMED') {
      refund.markUnconfirmed({ attempt: 1, failureReason: 'ETIMEDOUT' });
    } else if (state === 'CONFIRMED') {
      refund.markConfirmedByProvider({
        attempt: 1,
        providerRefundRef: 'rf_1',
      });
    }
    return refund;
  };

  const build = (
    bp: BookingPayment | null,
    refund: BookingPaymentRefund | null = null
  ) => {
    const order: string[] = [];
    const bookingPaymentRepo = {
      findByIdForUpdate: jest.fn(async () => {
        order.push('lock:bp');
        return bp;
      }),
    };
    const refundRepo = {
      findByCharge: jest.fn(async () => {
        order.push('read:refund');
        return refund;
      }),
    };
    return {
      service: new BookingPaymentCollectionService(
        bookingPaymentRepo as never,
        refundRepo as never
      ),
      order,
      refundRepo,
    };
  };

  it('iyzico: iade yoksa tahsil edilen TRY döner (satış EUR olsa bile)', async () => {
    const bp = paid('IYZICO');
    const { service } = build(bp);

    const amount = await service.lockAndGetReversibleAmount({
      bookingPaymentId: bp.id.value,
    });

    expect(amount.toFixed(2)).toBe('4200.00');
  });

  it('kilit ÖNCE, iade satırı okuması SONRA (iade yollarıyla aynı kilit sırası)', async () => {
    const bp = paid('IYZICO');
    const { service, order } = build(bp);

    await service.lockAndGetReversibleAmount({ bookingPaymentId: bp.id.value });

    expect(order).toEqual(['lock:bp', 'read:refund']);
  });

  it.each(['PENDING', 'UNCONFIRMED', 'CONFIRMED'] as const)(
    '%s iade parayı geri götürüyor/götürmüş sayılır → geri götürülebilir tutar 0',
    async (state) => {
      const bp = paid('IYZICO');
      const { service } = build(bp, refundFor(bp, state));

      const amount = await service.lockAndGetReversibleAmount({
        bookingPaymentId: bp.id.value,
      });

      expect(amount.toFixed(2)).toBe('0.00');
    }
  );

  it('REDDEDİLEN (FAILED) iade parayı götürmedi: tutar tam kalır (itiraz mümkün)', async () => {
    const bp = paid('IYZICO');
    const { service } = build(bp, refundFor(bp, 'FAILED'));

    const amount = await service.lockAndGetReversibleAmount({
      bookingPaymentId: bp.id.value,
    });

    expect(amount.toFixed(2)).toBe('4200.00');
  });

  it('kayıt yoksa BookingPaymentNotFoundException', async () => {
    const { service } = build(null);

    await expect(
      service.lockAndGetReversibleAmount({ bookingPaymentId: 'yok' })
    ).rejects.toBeInstanceOf(BookingPaymentNotFoundException);
  });

  it('tahsil edilmemiş (ödeme referansı yok) ödeme itiraz edilemez', async () => {
    const bp = paid(null);
    const { service, refundRepo } = build(bp);

    await expect(
      service.lockAndGetReversibleAmount({ bookingPaymentId: bp.id.value })
    ).rejects.toBeInstanceOf(BookingPaymentNotChargeableException);
    expect(refundRepo.findByCharge).not.toHaveBeenCalled();
  });

  it('Stripe tahsilatı itiraz edilemez: kapanış akışı yok (§90)', async () => {
    const bp = paid('STRIPE');
    const { service } = build(bp);

    await expect(
      service.lockAndGetReversibleAmount({ bookingPaymentId: bp.id.value })
    ).rejects.toBeInstanceOf(BookingPaymentNotChargeableException);
  });
});
