import { RefundBookingPaymentHandler } from './refund-booking-payment.handler';
import { RefundBookingPaymentCommand } from './refund-booking-payment.command';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { IBookingPaymentRefundCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundAlreadyClaimedException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import {
  BookingPaymentRefundExecution,
  BookingPaymentRefundExecutor,
} from '@modules/crm/health-tourism/booking-payment/application/services/booking-payment-refund.executor';

describe('RefundBookingPaymentHandler — iptal sonrası iade talebi', () => {
  const hotelIntent: HotelBookingIntent = {
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
    intent: hotelIntent,
    clinicId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    patientId: '44444444-4444-4444-8444-444444444444',
    leadId: null,
    conversationId: 'conv-1',
  };

  const makeBooked = (provider: 'IYZICO' | 'STRIPE'): BookingPayment => {
    const bp = BookingPayment.create(props);
    bp.markPaid(provider, provider === 'IYZICO' ? 'tx_1' : 'pi_1');
    bp.markBooked('BK-1', 'BK-1');
    return bp;
  };

  const build = (bp: BookingPayment | null) => {
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};
    const saved: BookingPayment[] = [];
    const created: BookingPaymentRefund[] = [];

    // Okuma da command repo'da ve KİLİTLİ: iki eşzamanlı iptal isteği mükerrer iade çağıramaz.
    const bookingPaymentRepo = {
      findByBookingIdForUpdate: jest.fn(() => {
        depthAtCall.load = txDepth;
        return Promise.resolve(bp);
      }),
      update: jest.fn((e: BookingPayment) => {
        saved.push(e);
        return Promise.resolve(e);
      }),
    } as unknown as IBookingPaymentCommandRepository;

    const refundRepo = {
      create: jest.fn((e: BookingPaymentRefund) => {
        depthAtCall.create = txDepth;
        created.push(e);
        return Promise.resolve(e);
      }),
    } as unknown as IBookingPaymentRefundCommandRepository;

    const execute = jest.fn((refund: BookingPaymentRefund) => {
      depthAtCall.executor = txDepth;
      return Promise.resolve<BookingPaymentRefundExecution>({
        refundId: refund.id.value,
        status: 'CONFIRMED',
        settleConflict: false,
      });
    });
    const refundExecutor = {
      execute,
    } as unknown as BookingPaymentRefundExecutor;

    const txManager = {
      run: jest.fn(async (cb: () => Promise<unknown>) => {
        txDepth++;
        try {
          return await cb();
        } finally {
          txDepth--;
        }
      }),
    } as never;

    return {
      handler: new RefundBookingPaymentHandler(
        bookingPaymentRepo,
        refundRepo,
        refundExecutor,
        txManager
      ),
      bookingPaymentRepo,
      refundRepo,
      execute,
      saved,
      created,
      depthAtCall,
    };
  };

  const command = (
    retained: { amount: string; currency: 'EUR' } | null = null
  ) =>
    new RefundBookingPaymentCommand({
      bookingId: 'BK-1',
      reason: 'iptal',
      retained,
    });

  it('Stripe: tahsil edilen saleAmount/saleCurrency iade satırı olarak talep edilir; bp REFUNDED', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, created, saved } = build(bp);

    const response = await handler.execute(command());

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      kind: 'CANCELLATION',
      provider: 'STRIPE',
    });
    expect(created[0].amount.toApiFormat()).toBe('120.00');
    expect(created[0].amount.currency).toBe('EUR');
    expect(created[0].chargeProviderRef).toBe('pi_1');
    expect(saved[0].status).toBe('REFUNDED');
    expect(response).toEqual({
      refundId: created[0].id.value,
      status: 'CONFIRMED',
    });
  });

  it('iyzico: TRY tutar (tryAmount) talep edilir — satış EUR olsa bile', async () => {
    const { handler, created } = build(makeBooked('IYZICO'));

    await handler.execute(command());

    expect(created[0].amount.toApiFormat()).toBe('4200.00');
    expect(created[0].amount.currency).toBe('TRY');
  });

  it('claim (kilitli okuma + bp güncelleme + satır) tx İÇİNDE, sağlayıcı çağrısı tx DIŞINDA', async () => {
    const { handler, depthAtCall } = build(makeBooked('IYZICO'));

    await handler.execute(command());

    expect(depthAtCall.load).toBe(1);
    expect(depthAtCall.create).toBe(1);
    // Uzun sağlayıcı çağrısı satır kilidini ve tx bağlantısını tutmaz.
    expect(depthAtCall.executor).toBe(0);
  });

  it('sağlayıcının bildirdiği iptal cezası claim ile aynı tx’te bp’ye damgalanır', async () => {
    const { handler, saved } = build(makeBooked('STRIPE'));

    await handler.execute(command({ amount: '15.00', currency: 'EUR' }));

    expect(saved[0].supplierRetained?.toApiFormat()).toBe('15.00');
  });

  it('executor sonucu UNCONFIRMED ise yanıt “iade edildi” demez', async () => {
    const { handler, execute } = build(makeBooked('IYZICO'));
    execute.mockImplementation((refund: BookingPaymentRefund) =>
      Promise.resolve<BookingPaymentRefundExecution>({
        refundId: refund.id.value,
        status: 'UNCONFIRMED',
        settleConflict: false,
      })
    );

    const response = await handler.execute(command());

    expect(response.status).toBe('UNCONFIRMED');
  });

  it('ödeme kaydı yoksa (B7 öncesi) iptal akışını bozmadan SKIPPED', async () => {
    const { handler, execute, created } = build(null);

    const response = await handler.execute(command());

    expect(response).toEqual({ refundId: null, status: 'SKIPPED' });
    expect(execute).not.toHaveBeenCalled();
    expect(created).toHaveLength(0);
  });

  it('BOOKED olmayan kayıt iade edilmez (ikinci eşzamanlı istek)', async () => {
    const bp = makeBooked('IYZICO');
    bp.markRefunded({ reason: 'ilk istek', retained: null });
    const { handler, execute } = build(bp);

    const response = await handler.execute(command());

    expect(response.status).toBe('SKIPPED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('ödeme referansı yoksa iade edilmez', async () => {
    const bp = BookingPayment.create(props);
    const { handler, execute } = build(bp);

    const response = await handler.execute(command());

    expect(response.status).toBe('SKIPPED');
    expect(execute).not.toHaveBeenCalled();
  });

  it('aynı tahsilat için iade zaten talep edilmişse (unique çakışması) SKIPPED, ikinci çağrı yok', async () => {
    const { handler, refundRepo, execute } = build(makeBooked('IYZICO'));
    (refundRepo.create as jest.Mock).mockRejectedValue(
      new BookingPaymentRefundAlreadyClaimedException('IYZICO', 'tx_1')
    );

    const response = await handler.execute(command());

    expect(response.status).toBe('SKIPPED');
    expect(execute).not.toHaveBeenCalled();
  });
});
