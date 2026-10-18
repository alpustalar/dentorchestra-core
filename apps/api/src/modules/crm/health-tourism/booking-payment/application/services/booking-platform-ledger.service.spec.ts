import { BookingPlatformLedgerService } from './booking-platform-ledger.service';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { CriticalFailurePayload } from '@common/observability/critical-failure.event';
import { BookingLedgerNotPostableException } from '@modules/crm/health-tourism/booking-payment/domain/exceptions/booking-payment.exceptions';
import { IPlatformTenantProvider } from '@modules/finance/accounting/posting/domain/interfaces/platform-tenant.provider.interface';
import { EnsurePartyCommand } from '@modules/finance/party/application/commands/ensure-party/ensure-party.command';
import { RecordFinancialEventCommand } from '@modules/finance/accounting/financial-events/application/commands/record-financial-event/record-financial-event.command';
import { BookingPayment } from '@modules/crm/health-tourism/booking-payment/domain/entities/booking-payment.entity';
import {
  CreateBookingPaymentProps,
  HotelBookingIntent,
  SupplierRetainedCost,
} from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';

const SUPPLIER_PARTY = '55555555-5555-4555-8555-555555555555';

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

/** sale 120 = tedarikçi 100 + komisyon 20. */
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
  patientId: null,
  leadId: null,
  conversationId: null,
};

describe('BookingPlatformLedgerService', () => {
  const build = () => {
    const execute = jest.fn<Promise<string>, [unknown]>((command: unknown) =>
      Promise.resolve(
        command instanceof EnsurePartyCommand ? SUPPLIER_PARTY : 'event-1'
      )
    );
    const commandBus = { execute } as unknown as TSCommandBus;
    const platformTenant = {
      resolve: jest.fn(() =>
        Promise.resolve({
          clinicId: '99999999-9999-4999-8999-999999999999',
          organizationId: '88888888-8888-4888-8888-888888888888',
        })
      ),
    } as unknown as IPlatformTenantProvider;
    // Spy ayrı değişkende tutulur: `expect(obj.method)` yazmak metodu
    // nesnesinden koparıp `unbound-method` borcu üretiyor. Girdi tipi de
    // yazılıyor — argümansız `jest.fn()` çağrı tuple'ını `[]` tipliyor ve
    // `mock.calls[0][0]` okuması `any`'ye düşüyor.
    const publish = jest.fn<void, [CriticalFailurePayload]>();
    const criticalFailure = {
      publish,
    } as unknown as CriticalFailurePublisher;

    return {
      service: new BookingPlatformLedgerService(
        commandBus,
        platformTenant,
        criticalFailure
      ),
      execute,
      platformTenant,
      criticalFailure,
      publish,
    };
  };

  const booked = (supplierActual?: string): BookingPayment => {
    const bp = BookingPayment.create(props);
    bp.markPaid('STRIPE', 'pi_1');
    bp.markBooked('BK-1', 'BK-1');
    if (supplierActual) {
      bp.recordSupplierCost({ amount: supplierActual, currency: 'EUR' });
    }
    return bp;
  };

  const refunded = (
    retained: SupplierRetainedCost | null,
    supplierActual?: string
  ): BookingPayment => {
    const bp = booked(supplierActual);
    bp.markRefunded({ reason: 'iptal', retained });
    return bp;
  };

  const recordedEvent = (execute: jest.Mock<Promise<string>, [unknown]>) =>
    execute.mock.calls
      .map(([command]) => command)
      .find(
        (command): command is RecordFinancialEventCommand =>
          command instanceof RecordFinancialEventCommand
      );

  it('tedarikçi carisi olay YAZILMADAN ÖNCE garanti edilir', async () => {
    // 320 `requiresParty`: cari sonradan eklenemez (olay defteri append-only),
    // eksik cari postlanamayan ölümsüz bir olay bırakır.
    const { service, execute } = build();

    await service.recordBestEffort({
      kind: 'SETTLED',
      bp: booked(),
      provider: 'STRIPE',
    });

    const order = execute.mock.calls.map(
      ([c]) => (c as object).constructor.name
    );
    expect(order).toEqual([
      EnsurePartyCommand.name,
      RecordFinancialEventCommand.name,
    ]);
    const ensure = execute.mock.calls[0][0] as EnsurePartyCommand;
    expect(ensure.input).toEqual(
      expect.objectContaining({
        originType: 'EXTERNAL',
        originId: 'HOTELBEDS',
        role: 'SUPPLIER',
      })
    );
  });

  it('uçuş rezervasyonunda tedarikçi Duffel’dır (tahsilat kanalı değil)', async () => {
    const { service, execute } = build();
    const bp = BookingPayment.create({
      ...props,
      bookingType: 'FLIGHT',
      intent: {
        type: 'FLIGHT',
        mode: 'INSTANT',
        optionId: 'opt_1',
        clinicId: props.clinicId,
        passengers: [],
        contactEmail: 'a@b.com',
        contactPhone: '+905551112233',
        summary: 'IST → LHR',
      },
    });
    bp.markPaid('IYZICO', 'tx_1');
    bp.markBooked('ORD-1', 'ORD-1');

    await service.recordBestEffort({ kind: 'SETTLED', bp, provider: 'IYZICO' });

    const ensure = execute.mock.calls[0][0] as EnsurePartyCommand;
    expect(ensure.input.originId).toBe('DUFFEL');
  });

  it('SETTLED: komisyon = satış − defterin yazdığı tedarikçi payı', async () => {
    const { service, execute } = build();

    await service.recordBestEffort({
      kind: 'SETTLED',
      bp: booked('105.00'),
      provider: 'STRIPE',
    });

    const recorded = recordedEvent(execute);
    expect(recorded?.data.type).toBe('PLATFORM_BOOKING_SETTLED');
    expect(recorded?.data.payload).toEqual(
      expect.objectContaining({
        saleAmount: '120.00',
        supplierAmount: '105.00',
        commission: '15.00',
        supplierPartyId: SUPPLIER_PARTY,
      })
    );
  });

  it('REFUNDED: ters kayıt gövdesi iade + ceza + serbest kalan borcu taşır', async () => {
    const { service, execute } = build();

    await service.recordBestEffort({
      kind: 'REFUNDED',
      bp: refunded({ amount: '30.00', currency: 'EUR' }),
      provider: 'STRIPE',
    });

    const recorded = recordedEvent(execute);
    expect(recorded?.data.type).toBe('PLATFORM_BOOKING_REFUNDED');
    expect(recorded?.data.payload).toEqual(
      expect.objectContaining({
        refundAmount: '120.00',
        commission: '20.00',
        supplierReleased: '70.00',
        retainedLoss: '30.00',
      })
    );
    // Anahtar ödeme kaydının id'sidir: aynı iade iki kez köprülenmez.
    expect(recorded?.data.dedupeKey).toBe(
      `platform-booking-refunded:${recorded?.data.sourceRefId}`
    );
  });

  it('ceza tedarikçi maliyetini aşıyorsa olay HİÇ yazılmaz (ölümsüz fişsiz kayıt olmasın)', async () => {
    const { service, execute, publish } = build();

    await service.recordBestEffort({
      kind: 'REFUNDED',
      bp: refunded({ amount: '150.00', currency: 'EUR' }),
      provider: 'STRIPE',
    });

    expect(recordedEvent(execute)).toBeUndefined();
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'CRITICAL' })
    );
  });

  it('maliyetin altında satışın iadesinde olay yazılmaz (ileri fiş de yoktu)', async () => {
    const { service, execute, publish } = build();

    await service.recordBestEffort({
      kind: 'REFUNDED',
      bp: refunded({ amount: '0.00', currency: 'EUR' }, '130.00'),
      provider: 'STRIPE',
    });

    expect(recordedEvent(execute)).toBeUndefined();
    expect(publish).toHaveBeenCalled();
  });

  it('`record` yazılamayan fişi ADIYLA reddeder (telafi turu gerekçeyi görsün)', async () => {
    // `recordBestEffort` alarmı basıp yutuyor; telafi komutu ise hangi hareketin
    // neden yazılamadığını satır satır bildirmek zorunda — ve bu iki hâl
    // yeniden denemeyle çözülmez (muhasebe kararı bekler).
    const { service } = build();

    await expect(
      service.record({
        kind: 'REFUNDED',
        bp: refunded({ amount: '150.00', currency: 'EUR' }),
        provider: 'STRIPE',
      })
    ).rejects.toBeInstanceOf(BookingLedgerNotPostableException);
  });

  it('yazılamayan fişin alarmı genel metni DEĞİL, sebebini söyler', async () => {
    const { service, publish } = build();

    await service.recordBestEffort({
      kind: 'REFUNDED',
      bp: refunded({ amount: '0.00', currency: 'EUR' }, '130.00'),
      provider: 'STRIPE',
    });

    expect(publish.mock.calls[0][0].summary).toContain(
      'maliyetin altında satış'
    );
  });

  it('best-effort: defter hatası yükselmez, CRITICAL ile duyurulur', async () => {
    // Hata fırlatmak çağıranın telafi dalını tetikleyip başarılı bir
    // rezervasyonu/iadeyi geri almaya çalışırdı.
    const { service, platformTenant, publish } = build();
    (platformTenant.resolve as jest.Mock).mockRejectedValue(
      new Error('platform kiracısı yok')
    );

    await expect(
      service.recordBestEffort({
        kind: 'REFUNDED',
        bp: refunded(null),
        provider: 'STRIPE',
      })
    ).resolves.toBeUndefined();

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'health-tourism.booking-payment.platform-ledger',
        severity: 'CRITICAL',
      })
    );
  });

  describe('fişin para birimi = paranın fiilen hareket ettiği birim', () => {
    const iyzicoBooked = (): BookingPayment => {
      const bp = BookingPayment.create(props);
      bp.markPaid('IYZICO', 'tx_1');
      bp.markBooked('BK-1', 'BK-1');
      bp.recordSupplierCost({ amount: '100.00', currency: 'EUR' });
      return bp;
    };

    it('SETTLED + iyzico: gövde TRY ve 108 fiilen gelen parayı taşır', async () => {
      // Eski davranış: gövde EUR (120.00) yazıyordu ve posting kuru olay
      // tarihine göre TCMB'den yeniden türetiyordu → 108'e hastanın hiç
      // ödemediği bir tutar, farkı da sessizce komisyona biniyordu.
      const { service, execute } = build();

      await service.recordBestEffort({
        kind: 'SETTLED',
        bp: iyzicoBooked(),
        provider: 'IYZICO',
      });

      expect(recordedEvent(execute)?.data.payload).toEqual(
        expect.objectContaining({
          currency: 'TRY',
          saleAmount: '4200.00', // fiilen çekilen
          supplierAmount: '3500.00', // 100 EUR × 35 (kilitli kur)
          commission: '700.00',
          originalCurrency: 'EUR',
          fxRate: '35.000000',
          supplierOriginalAmount: '100.00',
        })
      );
    });

    it('REFUNDED + iyzico: ters kayıt da TRY ve orijinal temeli taşır', async () => {
      const { service, execute } = build();
      const bp = iyzicoBooked();
      bp.markRefunded({
        reason: 'iptal',
        retained: { amount: '20.00', currency: 'EUR' },
      });

      await service.recordBestEffort({
        kind: 'REFUNDED',
        bp,
        provider: 'IYZICO',
      });

      expect(recordedEvent(execute)?.data.payload).toEqual(
        expect.objectContaining({
          currency: 'TRY',
          refundAmount: '4200.00',
          commission: '700.00',
          supplierReleased: '2800.00',
          retainedLoss: '700.00',
          originalCurrency: 'EUR',
          fxRate: '35.000000',
          supplierReleasedOriginalAmount: '80.00',
          retainedLossOriginalAmount: '20.00',
        })
      );
    });

    it('Stripe: gövde satış cinsinde kalır, orijinal temel YOK', async () => {
      // Stripe satış cinsinden çeker → çevrim posting'in işi (olay tarihli
      // TCMB kuru). Burada kilitli kuru taşımak iki kur kaynağı yaratırdı.
      const { service, execute } = build();

      await service.recordBestEffort({
        kind: 'SETTLED',
        bp: booked('100.00'),
        provider: 'STRIPE',
      });

      const payload = recordedEvent(execute)?.data.payload as Record<
        string,
        unknown
      >;
      expect(payload.currency).toBe('EUR');
      expect(payload.saleAmount).toBe('120.00');
      expect(payload.originalCurrency).toBeUndefined();
      expect(payload.fxRate).toBeUndefined();
    });

    it('kilitli kur yoksa olay HİÇ yazılmaz ve alarm "yazılamaz" der', async () => {
      // "Kur yoksa 1 kabul et" dengeyi bozmaz → hiçbir kontrol yakalamaz.
      const { service, execute, publish } = build();
      const bp = BookingPayment.create({ ...props, fxRate: null });
      bp.markPaid('IYZICO', 'tx_1');
      bp.markBooked('BK-1', 'BK-1');

      await service.recordBestEffort({
        kind: 'SETTLED',
        bp,
        provider: 'IYZICO',
      });

      expect(recordedEvent(execute)).toBeUndefined();
      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish.mock.calls[0][0].summary).toContain('yazılamaz');
    });
  });
});
