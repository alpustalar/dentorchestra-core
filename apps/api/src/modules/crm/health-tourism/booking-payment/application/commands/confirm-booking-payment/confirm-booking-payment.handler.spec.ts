import { ConfirmBookingPaymentHandler } from './confirm-booking-payment.handler';
import { ConfirmBookingPaymentCommand } from './confirm-booking-payment.command';
import { BookingPlatformLedgerService } from '@modules/crm/health-tourism/booking-payment/application/services/booking-platform-ledger.service';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { IPaymentLinkProvider } from '@src/infrastructure/payment/links/payment-link.port';
import { IBookingPaymentCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment/booking-payment.command.repository';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import { BookingPaymentRefund } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment-refund.entity';
import { BookingPaymentRefundAlreadyClaimedException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment-refund.exceptions';
import { IBookingPaymentRefundCommandRepository } from '@modules/crm/health-tourism/booking-payment/domain/repositories/booking-payment-refund/booking-payment-refund.command.repository';
import {
  BookingPaymentRefundExecution,
  BookingPaymentRefundExecutor,
} from '@modules/crm/health-tourism/booking-payment/application/services/booking-payment-refund.executor';
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
import { ExecutionSources } from '../../../../../../../../../../packages/shared/common/constants/execution-source.constant';
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

  type BookedSupplierResultLike = {
    bookingId: string;
    supplierAmount: string;
    supplierCurrency: string;
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
    state: 'PENDING' | 'BOOKED' | 'REFUNDED',
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
    if (state === 'REFUNDED') {
      // Ödeme alındı, rezervasyon açılamadı, iade edildi: terminal ama
      // "settled" olmayan durum.
      bp.markPaid('STRIPE', 'pi_first');
      bp.markFailed('rate expired');
      bp.markRefunded({ reason: 'iade edildi', retained: null });
    }
    return bp;
  };

  /**
   * Sağlayıcının rezervasyonu açarken bildirdiği FİİLÎ maliyet. Varsayılan,
   * teklifle (netAmount=100 EUR) birebir aynı: yani "sapma yok" hâli. Sapmayı
   * ölçen testler bunu bilerek değiştirir.
   */
  const supplierCost = (
    amount = '100.00',
    currency = 'EUR'
  ): BookedSupplierResultLike => ({
    bookingId: 'BK-1',
    supplierAmount: amount,
    supplierCurrency: currency,
  });

  const build = (
    bp: BookingPayment | null,
    bookThrows = false,
    booked: BookedSupplierResultLike = supplierCost()
  ) => {
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
        // book komutları artık id + FİİLÎ maliyet döner; diğer komutların
        // (RecordFinancialEvent) dönüşü kullanılmıyor, aynı nesne zararsız.
        return booked;
      }),
    } as unknown as TSCommandBus;

    const iyzicoLink = {
      provider: 'IYZICO',
      createLink: jest.fn(),
      expireLink: jest.fn(() => {
        recordDepth('iyzicoExpire');
        return Promise.resolve('NOT_SUPPORTED');
      }),
      refund: jest.fn(() => {
        recordDepth('iyzicoRefund');
        return Promise.resolve({
          outcome: 'SUCCEEDED',
          providerRefundRef: null,
        });
      }),
    } as unknown as IPaymentLinkProvider;

    const stripeLink = {
      provider: 'STRIPE',
      createLink: jest.fn(),
      expireLink: jest.fn(() => {
        recordDepth('stripeExpire');
        return Promise.resolve('EXPIRED');
      }),
      refund: jest.fn(() => {
        recordDepth('stripeRefund');
        return Promise.resolve({
          outcome: 'SUCCEEDED',
          providerRefundRef: null,
        });
      }),
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

    // İade satırları: (provider, charge_provider_ref) unique'ini taklit eden bellek içi depo.
    // Sahiplenme olay defterinin dedupe'u değil bu satırdır.
    const refunds: BookingPaymentRefund[] = [];
    const refundRepo = {
      findByCharge: jest.fn(
        (p: { provider: string; chargeProviderRef: string }) =>
          Promise.resolve(
            refunds.find(
              (r) =>
                r.provider === p.provider &&
                r.chargeProviderRef === p.chargeProviderRef
            ) ?? null
          )
      ),
      create: jest.fn((e: BookingPaymentRefund) => {
        recordDepth('refundCreate');
        if (
          refunds.some(
            (r) =>
              r.provider === e.provider &&
              r.chargeProviderRef === e.chargeProviderRef
          )
        ) {
          return Promise.reject(
            new BookingPaymentRefundAlreadyClaimedException(
              e.provider,
              e.chargeProviderRef
            )
          );
        }
        refunds.push(e);
        return Promise.resolve(e);
      }),
    } as unknown as IBookingPaymentRefundCommandRepository;

    // Yürütücü kendi spec'inde sınanır (sonuç sınıflama, settle, 336 açılışı). Burada yalnız
    // handler'ın ona NEYİ verdiği ve NE ZAMAN (tx dışında) çağırdığı sınanır; sağlayıcı
    // çağrısını gerçek adaptör mock'una iletir ki "hangi kanal, hangi tutar" iddiaları sürsün.
    const executorStatus: { next: BookingPaymentRefundExecution['status'] } = {
      next: 'CONFIRMED',
    };
    const refundExecutor = {
      execute: jest.fn(async (refund: BookingPaymentRefund) => {
        recordDepth('executor');
        const link = refund.provider === 'IYZICO' ? iyzicoLink : stripeLink;
        await link.refund({
          providerRef: refund.chargeProviderRef,
          amount: refund.amount.value.toNumber(),
          currency: refund.amount.currency,
          idempotencyKey: refund.idempotencyKey,
        });
        return {
          refundId: refund.id.value,
          status: executorStatus.next,
          settleConflict: false,
        };
      }),
    } as unknown as BookingPaymentRefundExecutor;

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
        refundRepo,
        refundExecutor,
        // Gerçek köprü servisi, mock bus/kiracı/alarm ile kurulur: böylece
        // olay gövdesi, platform defteri hedefi ve tedarikçi carisi zinciri
        // bu testlerin kapsamında kalır (servis ayrıca kendi spec'inde).
        new BookingPlatformLedgerService(
          commandBus,
          platformTenant,
          criticalFailure as never
        ),
        txManager,
        criticalFailure as never
      ),
      criticalFailure,
      refundRepo,
      refundExecutor,
      refunds,
      executorStatus,
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

  describe('teklif ↔ fiilî tedarikçi maliyeti', () => {
    const settledPayload = (commandBus: TSCommandBus) =>
      (
        (commandBus.execute as jest.Mock).mock.calls
          .map((c) => c[0])
          .find(
            (c) =>
              (c as object).constructor.name === 'RecordFinancialEventCommand'
          ) as { data: { payload: Record<string, string> } }
      ).data.payload;

    const confirm = async (
      handler: ConfirmBookingPaymentHandler,
      bp: BookingPayment
    ) =>
      handler.execute(
        new ConfirmBookingPaymentCommand({
          bookingPaymentId: bp.id.value,
          provider: 'STRIPE',
          providerRef: 'pi_1',
          ctx,
        })
      );

    it('defter sağlayıcının FİİLEN ücretlendirdiği tutardan yazılır (teklifi değil)', async () => {
      // Teklif 100, satış 120 (komisyon 20). HotelBeds rezervasyonu 105'e açtı:
      // tedarikçiye borç 105, komisyon 15. Eskiden teklif yazıldığı için 320
      // sağlayıcının faturalayacağı tutarı göstermiyor, komisyon 5 fazla
      // görünüyordu.
      const bp = makeBp('PENDING');
      const { handler, commandBus } = build(bp, false, supplierCost('105.00'));

      await confirm(handler, bp);

      const payload = settledPayload(commandBus);
      expect(payload.supplierAmount).toBe('105.00');
      expect(payload.commission).toBe('15.00');
      expect(payload.saleAmount).toBe('120.00');
      // Fiilî maliyet kayda da damgalanır (mutabakat + iade için).
      expect(bp.supplierAmount?.toApiFormat()).toBe('105.00');
    });

    it('sapma WARNING ile duyurulur; rezervasyon bozulmaz', async () => {
      const bp = makeBp('PENDING');
      const { handler, criticalFailure } = build(
        bp,
        false,
        supplierCost('105.00')
      );

      await confirm(handler, bp);

      const alert = criticalFailure.publish.mock.calls
        .map((c) => c[0] as Record<string, unknown>)
        .find(
          (a) => a.operation === 'health-tourism.booking-payment.supplier-cost'
        );
      expect(alert).toMatchObject({ severity: 'WARNING' });
      expect(alert?.context).toMatchObject({
        quotedAmount: '100.00',
        supplierAmount: '105.00',
        postedSupplierAmount: '105.00',
      });
      expect(bp.status).toBe('BOOKED');
    });

    it('sapma yoksa alarm YAYINLANMAZ', async () => {
      const bp = makeBp('PENDING');
      const { handler, criticalFailure } = build(bp);

      await confirm(handler, bp);

      expect(
        criticalFailure.publish.mock.calls.filter(
          (c) =>
            (c[0] as { operation: string }).operation ===
            'health-tourism.booking-payment.supplier-cost'
        )
      ).toHaveLength(0);
    });

    it('maliyet satışı aşarsa CRITICAL yayınlanır (maliyetin altında satış)', async () => {
      // Komisyon negatif olurdu; posting kuralı fişi reddeder ve olay
      // postlanmamış kalır. Alarm olmasa bu hiç görünmezdi.
      const bp = makeBp('PENDING');
      const { handler, criticalFailure } = build(
        bp,
        false,
        supplierCost('130.00')
      );

      await confirm(handler, bp);

      const alert = criticalFailure.publish.mock.calls
        .map((c) => c[0] as Record<string, unknown>)
        .find(
          (a) => a.operation === 'health-tourism.booking-payment.supplier-cost'
        );
      expect(alert).toMatchObject({ severity: 'CRITICAL' });
    });

    it('fiilî maliyet başka para birimindeyse CRITICAL + defter teklife düşer', async () => {
      const bp = makeBp('PENDING');
      const { handler, commandBus, criticalFailure } = build(
        bp,
        false,
        supplierCost('98.00', 'USD')
      );

      await confirm(handler, bp);

      expect(settledPayload(commandBus).supplierAmount).toBe('100.00');
      const alert = criticalFailure.publish.mock.calls
        .map((c) => c[0] as Record<string, unknown>)
        .find(
          (a) => a.operation === 'health-tourism.booking-payment.supplier-cost'
        );
      expect(alert).toMatchObject({ severity: 'CRITICAL' });
    });
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
    const { handler, commandBus, iyzicoLink, refunds } = build(bp);

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
    // İkinci çekim kendi iade satırını alır (rezervasyonun kendi tahsilatından AYRI).
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({
      kind: 'UNCLAIMED_CHARGE',
      provider: 'IYZICO',
      chargeProviderRef: 'tx_2',
    });
    expect(refunds[0].amount.toApiFormat()).toBe('4200.00');
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(bp.status).toBe('BOOKED');
  });

  it('çift-çekim: AYNI ikinci çekimin webhook’u tekrar gelirse ikinci iade çağrısı YAPILMAZ', async () => {
    // Sahiplenme olay defterinin dedupe'u değil iade SATIRININ unique'idir: dedupe mevcut
    // kimliği sessizce döner, "zaten vardı" bilgisini vermez.
    const bp = makeBp('BOOKED');
    const { handler, iyzicoLink, refunds } = build(bp);
    const second = () =>
      handler.execute(
        new ConfirmBookingPaymentCommand({
          bookingPaymentId: bp.id.value,
          provider: 'IYZICO',
          providerRef: 'tx_2',
          ctx,
        })
      );

    await second();
    await second();

    expect(refunds).toHaveLength(1);
    expect(iyzicoLink.refund).toHaveBeenCalledTimes(1);
  });

  it('AYNI referansla tekrar bildirim → iade YOK (idempotent)', async () => {
    // Stripe teslimatı at-least-once'tır ve iyzico callback'i kullanıcı sayfayı
    // yenilediğinde tekrar çalışır; ikisi de AYNI providerRef ile gelir. Karar
    // yerel duruma (`isSettled`) göre verildiğinde bu dal MEŞRU ödemeyi iade
    // ettiriyordu: hizmet verilmiş, para geri ödenmiş, kayıt hâlâ BOOKED.
    const bp = makeBp('BOOKED');
    const {
      handler,
      stripeLink,
      iyzicoLink,
      commandBus,
      criticalFailure,
      refunds,
    } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_first',
        ctx,
      })
    );

    expect(stripeLink.refund).not.toHaveBeenCalled();
    expect(iyzicoLink.refund).not.toHaveBeenCalled();
    expect(refunds).toHaveLength(0);
    expect(commandBus.execute).not.toHaveBeenCalled();
    expect(criticalFailure.publish).not.toHaveBeenCalled();
    expect(bp.status).toBe('BOOKED');
  });

  it('iade EDİLMİŞ kayda gelen yeni çekim de iade edilir (sessizce tutulmaz)', async () => {
    // Karar `isSettled` (PAID|BOOKED) üzerinden verildiğinde FAILED/REFUNDED/
    // EXPIRED kayıtta ne iade ne alarm vardı: para sessizce bizde kalıyordu.
    // Ulaşılabilir: iyzico'nun expire API'si yok, yani Stripe ödenip iade
    // edildikten sonra bile iyzico linki canlı kalıyor.
    const bp = makeBp('REFUNDED');
    const { handler, iyzicoLink, criticalFailure } = build(bp);

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'IYZICO',
        providerRef: 'tx_late',
        ctx,
      })
    );

    expect(iyzicoLink.refund).toHaveBeenCalledWith(
      expect.objectContaining({ providerRef: 'tx_late', currency: 'TRY' })
    );
    expect(criticalFailure.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'health-tourism.booking-payment.second-charge',
        severity: 'WARNING',
      })
    );
  });

  it('ikinci çekimin iadesi DOĞRULANAMADIYSA handler “iade edildi” uyarısı basmaz (alarmı yürütücü basar)', async () => {
    // Eskiden handler hata yakalayıp CRITICAL basıyordu; artık sağlayıcı sonucu üç durumlu ve
    // yürütücü REJECTED / UNCONFIRMED'ı kendisi duyurur. Handler'ın işi yanlış beyan etmemek.
    const bp = makeBp('BOOKED');
    const { handler, criticalFailure, executorStatus, refunds } = build(bp);
    executorStatus.next = 'UNCONFIRMED';

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'IYZICO',
        providerRef: 'tx_2',
        ctx,
      })
    );

    expect(refunds).toHaveLength(1);
    expect(criticalFailure.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'health-tourism.booking-payment.second-charge',
      })
    );
  });

  it('book başarısız → FAILED + BOOKING_FAILED iade satırı (aynı tx) → yürütücü iadeyi yürütür', async () => {
    const bp = makeBp('PENDING');
    const { handler, stripeLink, refunds, refundExecutor } = build(bp, true);

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
        idempotencyKey: `${refunds[0].id.value}:1`,
      })
    );
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({
      kind: 'BOOKING_FAILED',
      chargeProviderRef: 'pi_1',
    });
    expect(refundExecutor.execute).toHaveBeenCalledTimes(1);
    // REFUNDED'a çekmek artık yürütücünün işi (iade ONAYLANINCA); handler FAILED'da bırakır.
    expect(bp.status).toBe('FAILED');
  });

  it('iade yürütülürken BEKLENMEYEN hata → kritik uyarı; satır PENDING kalır, bp REFUNDED olmaz', async () => {
    // Akışın en kötü hali: para tahsil edildi, rezervasyon açılamadı ve iade yürütülemedi.
    // Sessiz kalmak müşterinin parasının karşılıksız kalması demek.
    const bp = makeBp('PENDING');
    const { handler, refundExecutor, criticalFailure } = build(bp, true);
    (refundExecutor.execute as jest.Mock).mockRejectedValue(
      new Error('db koptu')
    );

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
    expect(bp.status).toBe('FAILED');
  });

  it('başarısız rezervasyonun iade talebi tekrar teslimde ikinci kez açılmaz', async () => {
    const bp = makeBp('PENDING');
    const { handler, refunds, refundExecutor, refundRepo } = build(bp, true);
    (refundRepo.create as jest.Mock).mockRejectedValue(
      new BookingPaymentRefundAlreadyClaimedException('STRIPE', 'pi_1')
    );

    await handler.execute(
      new ConfirmBookingPaymentCommand({
        bookingPaymentId: bp.id.value,
        provider: 'STRIPE',
        providerRef: 'pi_1',
        ctx,
      })
    );

    expect(refunds).toHaveLength(0);
    expect(refundExecutor.execute).not.toHaveBeenCalled();
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

    expect(bp.status).toBe('FAILED');
    expect(depthAtCall.stripeRefund).toBe(0);
    // İade satırı FAILED damgasıyla AYNI tx'te açılır (araya düşen çökme "iadesiz FAILED" bırakmasın).
    expect(depthAtCall.refundCreate).toBe(1);
    expect(depthAtCall.executor).toBe(0);
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
