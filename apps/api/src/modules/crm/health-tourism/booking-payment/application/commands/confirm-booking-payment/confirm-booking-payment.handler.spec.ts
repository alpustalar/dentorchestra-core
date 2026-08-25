import { ConfirmBookingPaymentHandler } from './confirm-booking-payment.handler';
import { ConfirmBookingPaymentCommand } from './confirm-booking-payment.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IPaymentLinkProvider } from '@src/infrastructure/payment/links/payment-link.port';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BookingPaymentNotFoundException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import {
  CreateBookingPaymentProps,
  FlightBookingIntent,
  HotelBookingIntent,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { BookHotelCommand } from '@modules/crm/health-tourism/hotel/application/commands/book-hotel/book-hotel.command';
import { BookTransferCommand } from '@modules/crm/health-tourism/transfer/application/commands/book-transfer/book-transfer.command';
import { BookFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/book-flight/book-flight.command';
import { PayHeldFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/pay-held-flight/pay-held-flight.command';
import { NATS_SUBJECTS } from '@src/transport';
import { IGetContext } from '@common/decorators';
import { ExecutionSources } from '@src/domain/constants/execution-source.constant';
import { TransactionManager } from '@src/infrastructure/persistence/prisma/transaction/transaction.manager';

describe('ConfirmBookingPaymentHandler — saga (book replay / iade)', () => {
  // Entity.create UUID VO doğrulaması yaptığından fixture id'leri geçerli UUID olmalı.
  const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
  const ORG_ID = '22222222-2222-4222-8222-222222222222';
  const PATIENT_ID = '33333333-3333-4333-8333-333333333333';
  const LEAD_ID = '44444444-4444-4444-8444-444444444444';

  const ctx: IGetContext = {
    actor: {
      userId: 'user-1',
      clinicId: CLINIC_ID,
      organizationId: ORG_ID,
      managedClinics: [{ id: CLINIC_ID }],
    } as IGetContext['actor'],
    source: ExecutionSources.USER_ACTION,
  };

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
    clinicId: CLINIC_ID,
    organizationId: ORG_ID,
    patientId: null,
    leadId: LEAD_ID,
    conversationId: 'conv-1',
  };

  const makeBp = (
    state: 'PENDING' | 'BOOKED',
    patientId: string | null = null
  ): BookingPayment => {
    const bp = BookingPayment.create({ ...props, patientId });
    bp.attachLinks({
      iyzicoConversationId: bp.id.value,
      iyzicoUrl: 'https://iyzi',
      stripeSessionId: 'cs_1',
      stripeUrl: 'https://stripe',
    });
    if (state === 'BOOKED') {
      bp.markPaid('STRIPE', 'pi_first');
      bp.markBooked('BK-prev', 'BK-prev');
    }
    return bp;
  };

  const build = (bp: BookingPayment | null, bookThrows = false) => {
    // Dış çağrıların kilit (tx) içinde mi dışında mı yapıldığını ölçer: HotelBeds ve
    // iade çağrıları saniyeler sürer, satır kilidini o kadar tutmak kabul edilemez.
    let txDepth = 0;
    const depthAtCall: Record<string, number> = {};
    const recordDepth = (label: string) => {
      depthAtCall[label] = txDepth;
    };

    const commandBus = {
      execute: jest.fn(async (cmd: unknown) => {
        // book komutları + onay bildirimi
        if (cmd instanceof BookHotelCommand) recordDepth('book');
        if (bookThrows) throw new Error('rate expired');
        return 'BK-1';
      }),
    } as unknown as TSCommandBus;

    const iyzicoLink = {
      provider: 'IYZICO',
      createLink: jest.fn(),
      expireLink: jest.fn(() => recordDepth('iyzicoExpire')),
      refund: jest.fn(() => recordDepth('iyzicoRefund')),
    } as unknown as IPaymentLinkProvider;

    const stripeLink = {
      provider: 'STRIPE',
      createLink: jest.fn(),
      expireLink: jest.fn(() => recordDepth('stripeExpire')),
      refund: jest.fn(() => recordDepth('stripeRefund')),
    } as unknown as IPaymentLinkProvider;

    // Kilitli okuma: handler artık mutasyonu besleyen her okumayı findByIdForUpdate
    // ile yapar (tx içinde). findById bilerek tanımsız — kullanılırsa test patlar.
    const commandRepo = {
      findByIdForUpdate: jest.fn(async () => {
        recordDepth('load');
        return bp;
      }),
      update: jest.fn(async (e: BookingPayment) => {
        recordDepth('update');
        return e;
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
    } as unknown as TransactionManager;

    const natsClient = {
      emit: jest.fn(() => ({ subscribe: jest.fn() })),
    } as any;

    const policyFactory = {
      clinic: jest.fn().mockReturnValue({
        evaluator: {
          check: jest.fn().mockReturnValue({
            orThrow: () => undefined,
          }),
        },
      }),
    } as any;

    // Platform defteri: tahsilat kliniğe değil buraya postlanır.
    const platformTenant = {
      resolve: jest.fn().mockResolvedValue({
        clinicId: 'platform-clinic',
        organizationId: 'platform-org',
      }),
    } as any;

    // İade/defter/link hataları sessiz kalmasın diye uyarı yayınlanır.
    const criticalFailure = { publish: jest.fn() };

    return {
      handler: new ConfirmBookingPaymentHandler(
        commandBus,
        iyzicoLink,
        stripeLink,
        commandRepo,
        policyFactory,
        natsClient,
        platformTenant,
        txManager,
        criticalFailure as never
      ),
      criticalFailure,
      platformTenant,
      commandBus,
      iyzicoLink,
      stripeLink,
      commandRepo,
      policyFactory,
      natsClient,
      txManager,
      depthAtCall,
    };
  };

  it('PENDING + Stripe ödeme → PAID → book → BOOKED; diğer link (iyzico) expire edilir', async () => {
    const bp = makeBp('PENDING');
    const { handler, commandBus, iyzicoLink, natsClient } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    expect(bp.status).toBe('BOOKED');
    expect(bp.bookingReference).toBe('BK-1');
    const calls = (commandBus.execute as jest.Mock).mock.calls.map((c) => c[0]);
    // book + müşteri onay bildirimi (misafir → muhasebe atlanır)
    expect(calls.some((c) => c instanceof BookHotelCommand)).toBe(true);
    // Onay bildirimi artık komut değil olay: messaging ayrı serviste.
    expect(natsClient.emit).toHaveBeenCalledWith(
      NATS_SUBJECTS.booking.confirmed,
      expect.objectContaining({ clinicId: CLINIC_ID })
    );
    expect(iyzicoLink.expireLink).toHaveBeenCalledWith(bp.id.value);
  });

  it('hastalı rezervasyonda bile tahsilat KLİNİK defterine yazılmaz: platform defterine yazılır', async () => {
    const bp = makeBp('PENDING', PATIENT_ID);
    const { handler, commandBus, natsClient } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    expect(bp.status).toBe('BOOKED');
    const commands = (commandBus.execute as jest.Mock).mock.calls.map(
      (c) => c[0]
    );
    const dispatched = commands.map((c) => (c as object).constructor.name);

    // Klinik cari hesabı açılmaz — klinik bu işleme finansal olarak taraf değil.
    expect(dispatched).not.toContain('EnsurePartyForPatientCommand');

    const financialEvent = commands.find(
      (c) => (c as object).constructor.name === 'RecordFinancialEventCommand'
    ) as { data: { clinicId: string; type: string } };

    // Olay yazılır ama defter sahibi PLATFORM'dur; rezervasyonun kliniği DEĞİL.
    expect(financialEvent).toBeDefined();
    expect(financialEvent.data.clinicId).toBe('platform-clinic');
    expect(financialEvent.data.clinicId).not.toBe(CLINIC_ID);
    expect(financialEvent.data.type).toBe('PLATFORM_BOOKING_SETTLED');

    expect(dispatched).toEqual(expect.arrayContaining(['BookHotelCommand']));
    expect(natsClient.emit).toHaveBeenCalledWith(
      NATS_SUBJECTS.booking.confirmed,
      expect.objectContaining({ clinicId: CLINIC_ID })
    );
  });

  it('komisyon = brüt − tedarikçi payı; hasılat yalnız komisyon olacak şekilde yazılır', async () => {
    const bp = makeBp('PENDING', PATIENT_ID);
    const { handler, commandBus } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    const event = (commandBus.execute as jest.Mock).mock.calls
      .map((c) => c[0])
      .find(
        (c) => (c as object).constructor.name === 'RecordFinancialEventCommand'
      ) as { data: { payload: Record<string, string>; dedupeKey?: string } };

    const { saleAmount, supplierAmount, commission } = event.data.payload;
    expect(Number(commission)).toBeCloseTo(
      Number(saleAmount) - Number(supplierAmount),
      2
    );
  });

  it('muhasebe kaydı düşse bile rezervasyon bozulmaz (tahsilat alınmış, otel açılmış)', async () => {
    const bp = makeBp('PENDING', PATIENT_ID);
    const { handler, platformTenant } = build(bp);
    platformTenant.resolve.mockRejectedValue(
      new Error('platform kiracısı yok')
    );

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    // Kayıt atılamadı ama rezervasyon ayakta; iade akışına DÜŞMEZ.
    expect(bp.status).toBe('BOOKED');
  });

  it('çift-çekim: zaten BOOKED kayda ikinci ödeme → ikinci ödeme iade, rebook YOK', async () => {
    const bp = makeBp('BOOKED');
    const { handler, commandBus, iyzicoLink } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'IYZICO',
        providerRef: 'tx_2',
        ctx,
      })
    );

    expect(iyzicoLink.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRef: 'tx_2',
        currency: 'TRY',
        amount: 4200,
      })
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(bp.status).toBe('BOOKED');
  });

  it('book başarısız → FAILED → ödeme iade → REFUNDED', async () => {
    const bp = makeBp('PENDING');
    const { handler, stripeLink } = build(bp, true);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    expect(stripeLink.refund).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRef: 'pi_1',
        currency: 'EUR',
        amount: 120,
      })
    );
    expect(bp.status).toBe('REFUNDED');
  });

  it('iade DE başarısızsa kritik uyarı yayınlanır (para müşteride değil, hizmet de yok)', async () => {
    // Akışın en kötü hali ve tek telafisi elle iade: burada sessiz kalmak,
    // müşterinin parasının karşılıksız kalması demek. Daha önce yalnız log'a
    // yazılıyordu (kodda "TODO: event fırlatılacak" notu duruyordu).
    const bp = makeBp('PENDING');
    const { handler, stripeLink, criticalFailure } = build(bp, true);
    (stripeLink.refund as jest.Mock).mockRejectedValue(new Error('stripe 500'));

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'health-tourism.booking-payment.refund',
        severity: 'CRITICAL',
        context: expect.objectContaining({ bookingPaymentId: bp.id.value }),
      })
    );
    // İade geçmediği için kayıt REFUNDED'a çekilmez; FAILED'da kalır.
    expect(bp.status).toBe('FAILED');
  });

  it('durumu besleyen okuma kilitli yapılır (findByIdForUpdate) ve tx içinde kalır', async () => {
    const bp = makeBp('PENDING');
    const { handler, commandRepo, txManager, depthAtCall } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    // Claim + finalize: iki ayrı kısa transaction.
    expect(txManager.run).toHaveBeenCalledTimes(2);
    expect(commandRepo.findByIdForUpdate).toHaveBeenCalledTimes(2);
    // Kilitsiz okuma yolu hiç kullanılmaz.
    expect((commandRepo as { findById?: unknown }).findById).toBeUndefined();
    // Okuma ve yazma daima kilit kapsamında (depth > 0).
    expect(depthAtCall.load).toBe(1);
    expect(depthAtCall.update).toBe(1);
  });

  it('HotelBeds book ve link expire çağrıları kilit dışında yapılır', async () => {
    const bp = makeBp('PENDING');
    const { handler, depthAtCall } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    // Saniyeler süren dış çağrılar satır kilidini tutmaz.
    expect(depthAtCall.book).toBe(0);
    expect(depthAtCall.iyzicoExpire).toBe(0);
  });

  it('book başarısızsa iade çağrısı da kilit dışında yapılır', async () => {
    const bp = makeBp('PENDING');
    const { handler, depthAtCall } = build(bp, true);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    expect(bp.status).toBe('REFUNDED');
    expect(depthAtCall.stripeRefund).toBe(0);
  });

  it('kayıt yoksa BookingPaymentNotFoundException', async () => {
    const { handler } = build(null);
    await expect(
      handler.execute(
        new ConfirmBookingPaymentCommand({
          bookingPaymentId: 'yok',
          provider: 'STRIPE',
          providerRef: 'pi_1',
          ctx,
        })
      )
    ).rejects.toBeInstanceOf(BookingPaymentNotFoundException);
  });

  // ────────────────────────────────────────────────────────────────────────────
  // FLIGHT — regresyon koruması
  //
  // `book()` ve `buildSummary()` eskiden ikili `if (HOTEL) … else …` idi ve
  // birleşime eklenen her yeni tür SESSİZCE transfer dalına düşüyordu (TypeScript
  // `else`'i kalan üyelere daraltıyor, `as` cast'i şekil uyuşmazlığını yutuyordu).
  // Aşağıdaki testler uçuşun kendi komutuna gittiğini kanıtlar.
  // ────────────────────────────────────────────────────────────────────────────
  describe('FLIGHT intent dispatch', () => {
    const makeFlightBp = (intent: FlightBookingIntent): BookingPayment => {
      const bp = BookingPayment.create({
        ...props,
        bookingType: 'FLIGHT',
        intent,
      });
      bp.attachLinks({
        iyzicoConversationId: bp.id.value,
        iyzicoUrl: 'https://iyzi',
        stripeSessionId: 'cs_1',
        stripeUrl: 'https://stripe',
      });
      return bp;
    };

    const holdIntent: FlightBookingIntent = {
      type: 'FLIGHT',
      mode: 'HOLD',
      flightBookingId: '55555555-5555-4555-8555-555555555555',
      duffelOrderId: 'ord_hold_1',
      summary: 'TK1988 · FRA 09:15 → IST 13:05 (aktarmasız)',
    };

    const instantIntent: FlightBookingIntent = {
      type: 'FLIGHT',
      mode: 'INSTANT',
      optionId: 'fl_abc12345',
      clinicId: CLINIC_ID,
      passengers: [
        {
          type: 'adult',
          givenName: 'Ada',
          familyName: 'Lovelace',
          bornOn: '1990-01-01',
        },
      ],
      contactEmail: 'ada@example.com',
      contactPhone: '+905550000000',
      summary: 'LH1300 · MUC 08:00 → IST 12:00 (aktarmasız)',
    };

    it('HOLD intent → PayHeldFlightCommand (koltuk tutulmuş, yalnız ödenir)', async () => {
      const bp = makeFlightBp(holdIntent);
      const { handler, commandBus } = build(bp);

      await handler.execute(
        new ConfirmBookingPaymentCommand({
          bookingPaymentId: bp.id.value,
          provider: 'STRIPE',
          providerRef: 'pi_1',
          ctx,
        })
      );

      const dispatched = (commandBus.execute as jest.Mock).mock.calls.map(
        ([cmd]) => cmd
      );

      const payCmd = dispatched.find((c) => c instanceof PayHeldFlightCommand);

      expect(payCmd).toBeDefined();
      expect(payCmd?.payload.bookingId).toBe(holdIntent.flightBookingId);
      // Transfer dalına düşmediğini açıkça kanıtla.
      expect(dispatched.some((c) => c instanceof BookTransferCommand)).toBe(
        false
      );
      expect(bp.status).toBe('BOOKED');
    });

    it('INSTANT intent → BookFlightCommand (sipariş ödemeyle birlikte açılır)', async () => {
      const bp = makeFlightBp(instantIntent);
      const { handler, commandBus } = build(bp);

      await handler.execute(
        new ConfirmBookingPaymentCommand({
          bookingPaymentId: bp.id.value,
          provider: 'STRIPE',
          providerRef: 'pi_1',
          ctx,
        })
      );

      const dispatched = (commandBus.execute as jest.Mock).mock.calls.map(
        ([cmd]) => cmd
      );

      const bookCmd = dispatched.find((c) => c instanceof BookFlightCommand);

      expect(bookCmd).toBeDefined();
      expect(bookCmd?.data.optionId).toBe(instantIntent.optionId);
      expect(bookCmd?.data.clinicId).toBe(CLINIC_ID);
      expect(dispatched.some((c) => c instanceof BookTransferCommand)).toBe(
        false
      );
      expect(bp.status).toBe('BOOKED');
    });

    it('uçuş özeti bildirime uçuşun kendi metniyle gider (transfer metni değil)', async () => {
      const bp = makeFlightBp(holdIntent);
      const { handler, natsClient } = build(bp);

      await handler.execute(
        new ConfirmBookingPaymentCommand({
          bookingPaymentId: bp.id.value,
          provider: 'STRIPE',
          providerRef: 'pi_1',
          ctx,
        })
      );

      const [subject, payload] = (natsClient.emit as jest.Mock).mock.calls[0];
      expect(subject).toBe(NATS_SUBJECTS.booking.confirmed);
      expect(payload.bookingType).toBe('FLIGHT');
      expect(payload.summary).toBe(holdIntent.summary);
    });
  });
});
