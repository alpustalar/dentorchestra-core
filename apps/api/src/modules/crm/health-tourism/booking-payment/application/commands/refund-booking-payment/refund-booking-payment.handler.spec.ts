import { RefundBookingPaymentHandler } from './refund-booking-payment.handler';
import { RefundBookingPaymentCommand } from './refund-booking-payment.command';
import { IPaymentLinkProvider } from '@src/infrastructure/payment/links/payment-link.port';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import {
  BookingLedgerInput,
  BookingPlatformLedgerService,
} from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

describe('RefundBookingPaymentHandler — iptal sonrası iade', () => {
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
    const iyzicoLink = {
      provider: 'IYZICO',
      createLink: jest.fn(),
      expireLink: jest.fn(),
      refund: jest.fn(),
    } as unknown as IPaymentLinkProvider;
    const stripeLink = {
      provider: 'STRIPE',
      createLink: jest.fn(),
      expireLink: jest.fn(),
      refund: jest.fn(),
    } as unknown as IPaymentLinkProvider;
    const saved: BookingPayment[] = [];
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};

    // Okuma da command repo'da (query repo command handler'dan kaldırıldı) ve artık
    // kilitli: iki eşzamanlı iptal isteği mükerrer iade çağıramaz.
    const commandRepo = {
      findByBookingIdForUpdate: jest.fn(() => {
        depthAtCall.load = txDepth;
        return Promise.resolve(bp);
      }),
      update: jest.fn((e: BookingPayment) => {
        saved.push(e);
        return Promise.resolve(e);
      }),
    } as unknown as IBookingPaymentCommandRepository;

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

    const platformLedger = {
      recordBestEffort: jest.fn<Promise<void>, [BookingLedgerInput]>(() => {
        depthAtCall.ledger = txDepth;
        return Promise.resolve();
      }),
    } as unknown as BookingPlatformLedgerService;

    const criticalFailure = {
      publish: jest.fn(),
    } as unknown as CriticalFailurePublisher;

    const trackRefund = (label: string) => () => {
      depthAtCall[label] = txDepth;
    };
    (iyzicoLink.refund as jest.Mock).mockImplementation(
      trackRefund('iyzicoRefund')
    );
    (stripeLink.refund as jest.Mock).mockImplementation(
      trackRefund('stripeRefund')
    );

    return {
      handler: new RefundBookingPaymentHandler(
        iyzicoLink,
        stripeLink,
        commandRepo,
        platformLedger,
        criticalFailure,
        txManager
      ),
      iyzicoLink,
      stripeLink,
      commandRepo,
      platformLedger,
      criticalFailure,
      saved,
      depthAtCall,
    };
  };

  it('Stripe ile ödenmişse saleAmount/saleCurrency iade + REFUNDED', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, stripeLink, saved } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({
        bookingId: 'BK-1',
        reason: 'iptal',
        retained: null,
      })
    );

    expect(stripeLink.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRef: 'pi_1',
        amount: 120,
        currency: 'EUR',
      })
    );
    expect(bp.status).toBe('REFUNDED');
    expect(saved).toHaveLength(1);
  });

  it('iyzico ile ödenmişse tryAmount/TRY iade', async () => {
    const bp = makeBooked('IYZICO');
    const { handler, iyzicoLink } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
    );

    expect(iyzicoLink.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRef: 'tx_1',
        amount: 4200,
        currency: 'TRY',
      })
    );
    expect(bp.status).toBe('REFUNDED');
  });

  it('ödeme kaydı yoksa (B7 öncesi) iade YOK, hata fırlatmaz', async () => {
    const { handler, iyzicoLink, stripeLink } = build(null);
    await expect(
      handler.execute(
        new RefundBookingPaymentCommand({
          bookingId: 'BK-UNKNOWN',
          retained: null,
        })
      )
    ).resolves.toBeUndefined();
    expect(iyzicoLink.refund).not.toHaveBeenCalled();
    expect(stripeLink.refund).not.toHaveBeenCalled();
  });

  it('durum BOOKED değilse (ör. zaten REFUNDED) iade tekrarlanmaz', async () => {
    const bp = makeBooked('STRIPE');
    bp.markRefunded({ reason: 'önceden iade', retained: null });
    const { handler, stripeLink } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
    );
    expect(stripeLink.refund).not.toHaveBeenCalled();
  });

  it('claim kilitli tx içinde, sağlayıcı iade çağrısı kilit dışında yapılır', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, commandRepo, depthAtCall } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
    );

    expect(commandRepo.findByBookingIdForUpdate).toHaveBeenCalledWith('BK-1');
    // Kilitsiz okuma yolu hiç kullanılmaz.
    expect(
      (commandRepo as { findByBookingId?: unknown }).findByBookingId
    ).toBeUndefined();
    expect(depthAtCall.load).toBe(1);
    expect(depthAtCall.stripeRefund).toBe(0);
  });

  it('sahiplenme sağlayıcı çağrısından ÖNCE yazılır (mükerrer iade olmaz)', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, stripeLink, saved } = build(bp);

    let statusAtRefund: string | undefined;
    (stripeLink.refund as jest.Mock).mockImplementation(() => {
      statusAtRefund = bp.status;
    });

    await handler.execute(
      new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
    );

    // İkinci eşzamanlı istek kilidi aldığında REFUNDED görür → iade çağırmaz.
    expect(statusAtRefund).toBe('REFUNDED');
    expect(saved).toHaveLength(1);
  });

  it('para geri gittikten SONRA platform defterine ters kayıt yazılır (kilit dışında)', async () => {
    // P0 regresyonu: iade kaydı REFUNDED yapıyor ve parayı geri veriyordu ama
    // tahsilat fişi (108/601/320) yerinde kalıyordu → 108 giden parayı, 601
    // kazanılmamış komisyonu, 320 artık olmayan borcu gösteriyordu.
    const bp = makeBooked('STRIPE');
    const { handler, platformLedger, depthAtCall } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
    );

    expect(platformLedger.recordBestEffort).toHaveBeenCalledWith({
      kind: 'REFUNDED',
      bp,
      provider: 'STRIPE',
    });
    // Defter yazımı satır kilidini tutmaz (dış çağrılarla aynı gerekçe).
    expect(depthAtCall.ledger).toBe(0);
  });

  it('sağlayıcıdan ceza geldiyse iade damgasıyla AYNI tx’te yazılır', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, saved } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({
        bookingId: 'BK-1',
        retained: { amount: '30.00', currency: 'EUR' },
      })
    );

    // Tek update: durum + ceza birlikte mühürlendi. Ayrı yazımlar araya düşen
    // bir çökmede "iade edildi ama cezası bilinmiyor" satırı bırakırdı ve ceza
    // bir daha sorulamaz (iptal çağrısı idempotent değil).
    expect(saved).toHaveLength(1);
    expect(bp.supplierRetained?.toApiFormat()).toBe('30.00');
    expect(bp.refundedAt).not.toBeNull();
    // Ceza tedarikçi borcundan düşer, kalanı serbest kalır, komisyon geri alınır.
    const assessment = bp.refundAssessment;
    expect(assessment.commission.toApiFormat()).toBe('20.00');
    expect(assessment.supplierReleased.toApiFormat()).toBe('70.00');
    expect(assessment.retainedLoss.toApiFormat()).toBe('30.00');
  });

  it('ceza bilinmiyorsa ters kayıt yazılır ama WARNING ile duyurulur', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, platformLedger, criticalFailure } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
    );

    // Yazmamak 108/601/320'yi birlikte yanlış bırakırdı; cezasız varsaymak
    // yalnız 320'yi eksik bırakır → yazılır, varsayım sesli olur.
    expect(platformLedger.recordBestEffort).toHaveBeenCalled();
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'health-tourism.booking-payment.cancellation-cost',
        severity: 'WARNING',
      })
    );
  });

  it('ceza bildirildiyse alarm ÇIKMAZ', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, criticalFailure } = build(bp);

    await handler.execute(
      new RefundBookingPaymentCommand({
        bookingId: 'BK-1',
        retained: { amount: '0.00', currency: 'EUR' },
      })
    );

    // '0.00' = "ücretsiz iptal" meşru bir cevaptır, "bilinmiyor" değil.
    expect(criticalFailure.publish).not.toHaveBeenCalled();
  });

  it('sağlayıcı iadesi düşerse ters kayıt YAZILMAZ ve CRITICAL çıkar', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, stripeLink, platformLedger, criticalFailure } = build(bp);
    (stripeLink.refund as jest.Mock).mockRejectedValue(
      new Error('stripe down')
    );

    await expect(
      handler.execute(
        new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
      )
    ).rejects.toThrow('stripe down');

    // Paranın geri gittiği doğrulanamadı → "iade edildi" fişi yanlış beyan olur.
    expect(platformLedger.recordBestEffort).not.toHaveBeenCalled();
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'health-tourism.booking-payment.refund',
        severity: 'CRITICAL',
      })
    );
  });

  it('sağlayıcı iadesi düşerse hata yükselir ama kayıt REFUNDED kalır (elle tamamlanır)', async () => {
    const bp = makeBooked('STRIPE');
    const { handler, stripeLink } = build(bp);
    (stripeLink.refund as jest.Mock).mockRejectedValue(
      new Error('stripe down')
    );

    await expect(
      handler.execute(
        new RefundBookingPaymentCommand({ bookingId: 'BK-1', retained: null })
      )
    ).rejects.toThrow('stripe down');

    // Durum geri alınmaz: geri alınsa yeniden deneme çift iade riskine açılırdı.
    expect(bp.status).toBe('REFUNDED');
  });
});
