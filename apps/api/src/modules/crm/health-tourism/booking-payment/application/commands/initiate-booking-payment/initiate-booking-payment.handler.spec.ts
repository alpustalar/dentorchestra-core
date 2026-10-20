import { InitiateBookingPaymentHandler } from './initiate-booking-payment.handler';
import {
  InitiateBookingPaymentCommand,
  InitiateBookingPaymentInput,
} from './initiate-booking-payment.command';
import { IPaymentLinkProvider } from '@src/infrastructure/payment/links/payment-link.port';
import { IFxRateProvider } from '@src/infrastructure/payment/links/fx-rate.port';
import { IServiceFeeProvider } from '@src/infrastructure/payment/links/service-fee.port';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { HotelBookingIntent } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookingPaymentInvalidNetAmountException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';

describe('InitiateBookingPaymentHandler — iki link + FX', () => {
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

  const baseInput: InitiateBookingPaymentInput = {
    bookingType: 'HOTEL',
    intent: hotelIntent,
    netAmount: 100,
    netCurrency: 'EUR',
    buyer: { name: 'Ali', surname: 'Veli', email: '', phone: '+90555' },
    clinicId: '11111111-1111-4111-8111-111111111111',
    organizationId: '22222222-2222-4222-8222-222222222222',
    patientId: null,
    leadId: '33333333-3333-4333-8333-333333333333',
    conversationId: 'conv-1',
    ip: '127.0.0.1',
  };

  const build = (opts?: {
    fxRate?: number;
    fxThrows?: boolean;
    iyzicoThrows?: boolean;
    stripeThrows?: boolean;
    serviceFeePercent?: number;
    /** Varsayılan AÇIK: eski senaryolar iki link bekliyor; kapalı senaryosu bilerek false verir. */
    stripeEnabled?: boolean;
  }) => {
    const saved: BookingPayment[] = [];

    const iyzicoLink = {
      provider: 'IYZICO',
      createLink: jest.fn(async () => {
        if (opts?.iyzicoThrows) throw new Error('iyzico down');
        return {
          provider: 'IYZICO' as const,
          sessionId: 'conv-1',
          token: 'tok',
          url: 'https://iyzi/pay',
        };
      }),
      expireLink: jest.fn(),
      refund: jest.fn(),
    } as unknown as IPaymentLinkProvider;

    const stripeLink = {
      provider: 'STRIPE',
      createLink: jest.fn(async () => {
        if (opts?.stripeThrows) throw new Error('stripe down');
        return {
          provider: 'STRIPE' as const,
          sessionId: 'cs_1',
          url: 'https://stripe/pay',
        };
      }),
      expireLink: jest.fn(),
      refund: jest.fn(),
    } as unknown as IPaymentLinkProvider;

    const fx = {
      getRate: jest.fn(async (from: string, to: string) => {
        if (opts?.fxThrows) throw new Error('no fx');
        if (from === to) return 1;
        return opts?.fxRate ?? 35;
      }),
    } as unknown as IFxRateProvider;

    // Komisyon artık platform-global ayardan gelir (klinikten değil). Test %20 kullanır.
    const serviceFee = {
      getServiceFeePercent: jest.fn(() => opts?.serviceFeePercent ?? 20),
    } as unknown as IServiceFeeProvider;

    const repo = {
      create: jest.fn(async (e: BookingPayment) => {
        saved.push(e);
        return e;
      }),
    } as unknown as IBookingPaymentCommandRepository;

    const txManager = {
      run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
    } as unknown as TransactionManager;

    return {
      handler: new InitiateBookingPaymentHandler(
        iyzicoLink,
        stripeLink,
        fx,
        serviceFee,
        repo,
        txManager,
        { stripeEnabled: opts?.stripeEnabled ?? true }
      ),
      iyzicoLink,
      stripeLink,
      repo,
      saved,
    };
  };

  it('EUR net + %20 fee → sale 120 EUR; iyzico TRY (×35=4200) + Stripe EUR; kayıt PENDING', async () => {
    const { handler, repo, saved } = build({ fxRate: 35 });
    const res = await handler.execute(
      new InitiateBookingPaymentCommand(baseInput)
    );

    expect(res.saleAmount).toBe(120);
    expect(res.saleCurrency).toBe('EUR');
    expect(res.iyzico).toEqual({
      url: 'https://iyzi/pay',
      amount: 4200,
      currency: 'TRY',
    });
    expect(res.stripe).toEqual({
      url: 'https://stripe/pay',
      amount: 120,
      currency: 'EUR',
    });
    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(saved[0].status).toBe('PENDING');
    expect(saved[0].iyzicoUrl?.value).toBe('https://iyzi/pay');
    expect(saved[0].stripeSessionId).toBe('cs_1');
  });

  it('FX çözülemezse iyzico atlanır, Stripe yine üretilir', async () => {
    const { handler, iyzicoLink } = build({ fxThrows: true });
    const res = await handler.execute(
      new InitiateBookingPaymentCommand(baseInput)
    );
    expect(res.iyzico).toBeNull();
    expect(res.stripe).not.toBeNull();
    expect(iyzicoLink.createLink).not.toHaveBeenCalled();
  });

  it('satış TRY ise Stripe atlanır, yalnız iyzico üretilir', async () => {
    const { handler, stripeLink } = build();
    const res = await handler.execute(
      new InitiateBookingPaymentCommand({ ...baseInput, netCurrency: 'TRY' })
    );
    expect(res.stripe).toBeNull();
    expect(res.iyzico).not.toBeNull();
    expect(res.iyzico?.currency).toBe('TRY');
    expect(stripeLink.createLink).not.toHaveBeenCalled();
  });

  it('satış fiyatı kuruşta yukarı yuvarlanır (ikili kayan nokta aşağı kaydırıyordu)', async () => {
    // Regresyon: `Math.round(17.9 * 1.05 * 100) / 100` → 18.79 çünkü çarpım
    // ikili tabanda 18.794999999999998 düşüyor. `Money` (Decimal + HALF_UP)
    // 18.795 → 18.80 verir. Fark bir kuruş ve HER ZAMAN platform aleyhine.
    const { handler, saved } = build({ fxRate: 35, serviceFeePercent: 5 });
    const res = await handler.execute(
      new InitiateBookingPaymentCommand({ ...baseInput, netAmount: 17.9 })
    );

    expect(res.saleAmount).toBe(18.8);
    expect(saved[0].saleAmount.toApiFormat()).toBe('18.80');
    // TRY tutarı da aynı kapıdan geçer: 18.80 × 35 = 658.00
    expect(saved[0].tryAmount.toApiFormat()).toBe('658.00');
  });

  it.each([0, -1, Number.NaN])(
    'fiyatı %p olan seçenek için link ÜRETİLMEZ (bedava/geçersiz satış)',
    async (netAmount) => {
      // Sağlayıcı yanıtında fiyat alanı eksik olduğunda eskiden `?? 0` ile sıfır
      // fiyat taşınıyordu; satış fiyatı ondan türetildiği için hastaya bedava
      // link gidiyordu. Kapı satışın türetildiği tek noktada.
      const { handler, iyzicoLink, stripeLink, repo } = build({ fxRate: 35 });

      await expect(
        handler.execute(
          new InitiateBookingPaymentCommand({ ...baseInput, netAmount })
        )
      ).rejects.toBeInstanceOf(BookingPaymentInvalidNetAmountException);

      expect(iyzicoLink.createLink).not.toHaveBeenCalled();
      expect(stripeLink.createLink).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
    }
  );

  it('iki sağlayıcı da başarısızsa hata fırlatır', async () => {
    const { handler } = build({ iyzicoThrows: true, stripeThrows: true });
    await expect(
      handler.execute(new InitiateBookingPaymentCommand(baseInput))
    ).rejects.toThrow();
  });

  describe('Stripe kanalı KAPALI (varsayılan; kapanış akışı yok — kural 16)', () => {
    it('yabancı para satışında Stripe linki ÜRETİLMEZ, yalnız iyzico TRY gider', async () => {
      const { handler, stripeLink, iyzicoLink, saved } = build({
        stripeEnabled: false,
      });

      const res = await handler.execute(
        new InitiateBookingPaymentCommand(baseInput)
      );

      expect(stripeLink.createLink).not.toHaveBeenCalled();
      expect(iyzicoLink.createLink).toHaveBeenCalledTimes(1);
      expect(res.stripe).toBeNull();
      expect(res.iyzico?.currency).toBe('TRY');
      expect(saved[0].stripeSessionId).toBeNull();
    });

    it('FX çözülemezse (iyzico de yok) link üretilemez → hata; Stripe sessizce devreye girmez', async () => {
      const { handler, stripeLink } = build({
        stripeEnabled: false,
        fxThrows: true,
      });

      await expect(
        handler.execute(new InitiateBookingPaymentCommand(baseInput))
      ).rejects.toThrow();
      expect(stripeLink.createLink).not.toHaveBeenCalled();
    });
  });
});
