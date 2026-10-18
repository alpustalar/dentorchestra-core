import { AiToolExecutor } from './ai-tool-executor.service';
import { AiToolRegistry } from './ai-tool.registry';
import { AiToolSupport } from '../application/ai-tool.support';
import { DiscoveryService } from '@nestjs/core';
import { SearchHotelsTool } from '@modules/crm/health-tourism/hotel/application/ai-tools/search-hotels.tool';
import { BookHotelTool } from '@modules/crm/health-tourism/hotel/application/ai-tools/book-hotel.tool';
import { GetHotelBookingsTool } from '@modules/crm/health-tourism/hotel/application/ai-tools/get-hotel-bookings.tool';
import { CancelHotelBookingTool } from '@modules/crm/health-tourism/hotel/application/ai-tools/cancel-hotel-booking.tool';
import { AI_TOOL_NAMES } from '@common/ai-tools';
import { AiToolContext } from '@common/ai-tools';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { GetClinicHealthTourismConfigQuery } from '@modules/crm/health-tourism/config/application/queries/get-clinic-health-tourism-config/get-clinic-health-tourism-config.query';
import { SearchHotelsQuery } from '@modules/crm/health-tourism/hotel/application/queries/search-hotels/search-hotels.query';
import { GetHotelBookingsQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-bookings/get-hotel-bookings.query';
import { GetHotelRateOptionQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-rate-option/get-hotel-rate-option.query';
import { CacheHotelRateOptionCommand } from '@modules/crm/health-tourism/hotel/application/commands/cache-hotel-rate-option/cache-hotel-rate-option.command';
import { InitiateBookingPaymentCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/initiate-booking-payment/initiate-booking-payment.command';
import { HotelBookingIntent } from '@modules/crm/health-tourism/booking-payment/domain/contracts/booking-payment';
import { HotelRateOptionToken } from '@modules/crm/health-tourism/hotel/domain/contracts';
import { IHotelCacheService } from '@modules/crm/health-tourism/hotel/domain/interfaces/hotel-cache.service.interface';
import { GetHotelRateOptionHandler } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-rate-option/get-hotel-rate-option.handler';
import { QuoteOptionOwnershipService } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-ownership.service';
import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';

describe('AiToolExecutor — otel araçları (B2)', () => {
  const context: AiToolContext = {
    clinicId: 'clinic-1',
    organizationId: 'org-1',
    conversationId: 'conv-1',
    channel: 'WHATSAPP',
    contactName: 'Ali Veli',
    contactPhone: '+905550001122',
    patientId: null,
    leadId: 'lead-1',
  };

  const enabledConfig = {
    isEnabled: true,
    nearbyHotelCodes: ['H1', 'H2'],
    destinationCode: 'IST-CITY',
  };

  const oneHotel = [
    {
      code: 'H1',
      name: 'Otel Bir',
      currency: 'EUR',
      minRate: 100,
      maxRate: 100,
      rooms: [
        {
          code: 'DBL',
          name: 'Double Room',
          rates: [
            {
              rateKey: 'RK-LONG-OPAQUE-1',
              rateType: 'BOOKABLE',
              net: 100,
              currency: 'EUR',
              boardCode: 'BB',
              boardName: 'Kahvaltı',
              rooms: 1,
              adults: 2,
              children: 0,
            },
          ],
        },
      ],
    },
  ];

  const build = (overrides?: {
    hotels?: unknown;
    bookings?: unknown[];
    config?: unknown;
  }) => {
    // Rate-option cache artık Redis'e doğrudan değil, hotel modülünün bus'ına gider:
    // CacheHotelRateOptionCommand (yaz) + GetHotelRateOptionQuery (oku).
    //
    // Anahtar **kiracı kapsamlı** (`clinicId:optionId`) ve okuma gerçek handler ile
    // yapılır: sahiplik kuralı bu testte fiilen koşar, taklit edilmez.
    const rateOptionStore = new Map<string, HotelRateOptionToken>();
    const cacheService: IHotelCacheService = {
      hotelRateOption: {
        get: (clinicId: string, token: string) =>
          Promise.resolve(rateOptionStore.get(`${clinicId}:${token}`) ?? null),
        set: (token: string, data: HotelRateOptionToken) => {
          rateOptionStore.set(`${data.owner.clinicId}:${token}`, data);
          return Promise.resolve();
        },
      },
    };
    const alarms = jest.fn();
    const rateOptionHandler = new GetHotelRateOptionHandler(
      cacheService,
      new QuoteOptionOwnershipService({
        publish: alarms,
      } as unknown as CriticalFailurePublisher)
    );

    const queryBus = {
      execute: jest.fn((q: unknown) => {
        if (q instanceof GetClinicHealthTourismConfigQuery) {
          return Promise.resolve({
            data: overrides?.config ?? enabledConfig,
          });
        }
        if (q instanceof SearchHotelsQuery) {
          return Promise.resolve({ data: overrides?.hotels ?? oneHotel });
        }
        if (q instanceof GetHotelBookingsQuery) {
          return Promise.resolve({
            data: overrides?.bookings ?? [],
          });
        }
        if (q instanceof GetHotelRateOptionQuery) {
          return rateOptionHandler.execute(q);
        }
        throw new Error('beklenmeyen query');
      }),
    } as unknown as TSQueryBus;

    const commandBus = {
      execute: jest.fn((c: unknown) => {
        if (c instanceof CacheHotelRateOptionCommand) {
          return cacheService.hotelRateOption.set(c.optionId, c.token);
        }
        return Promise.resolve({
          bookingPaymentId: 'bp-1',
          saleAmount: 120,
          saleCurrency: 'EUR',
          iyzico: {
            url: 'https://iyzi/pay/bp-1',
            amount: 4200,
            currency: 'TRY',
          },
          stripe: {
            url: 'https://stripe/pay/bp-1',
            amount: 120,
            currency: 'EUR',
          },
        });
      }),
    } as unknown as TSCommandBus;

    // Command+Strategy: araçlar registry'de; executor yalnız dispatch eder.
    const support = new AiToolSupport(commandBus, queryBus);
    const registry = new AiToolRegistry({} as DiscoveryService);
    registry.registerAll([
      new SearchHotelsTool(commandBus, queryBus, support),
      new BookHotelTool(commandBus, queryBus, support),
      new GetHotelBookingsTool(support),
      new CancelHotelBookingTool(commandBus, support),
    ]);

    return {
      executor: new AiToolExecutor(registry),
      commandBus,
      rateOptionStore,
      alarms,
    };
  };

  const call = (name: string, input: Record<string, unknown> = {}) => ({
    name,
    input,
  });

  it('search_hotels: kapsam allowlist ile aranır, rate cache’e mühürlenir, kısa optionId döner', async () => {
    const { executor, rateOptionStore } = build();
    const res = await executor.execute(
      call(AI_TOOL_NAMES.SEARCH_HOTELS, {
        checkIn: '2026-07-01',
        checkOut: '2026-07-05',
        adults: 2,
      }),
      context
    );

    const body = JSON.parse(res.content);
    expect(body.options).toHaveLength(1);
    const optionId = body.options[0].optionId;
    expect(optionId).toMatch(/^ht_/);
    // Opak rateKey LLM'e SIZMAZ; yalnız cache'te (bus üzerinden) durur.
    expect(res.content).not.toContain('RK-LONG-OPAQUE-1');
    expect(rateOptionStore.get(`clinic-1:${optionId}`)).toMatchObject({
      rateKey: 'RK-LONG-OPAQUE-1',
      hotelCode: 'H1',
      owner: { clinicId: 'clinic-1', conversationId: 'conv-1' },
    });
  });

  it('config kapalıysa arama yapılmaz', async () => {
    const { executor } = build({
      config: { ...enabledConfig, isEnabled: false },
    });
    const res = await executor.execute(
      call(AI_TOOL_NAMES.SEARCH_HOTELS, {
        checkIn: '2026-07-01',
        checkOut: '2026-07-05',
        adults: 2,
      }),
      context
    );
    expect(res.content).toContain('aktif değil');
  });

  it('book_hotel: ödeme-önce — iki link döner, rateKey gizli, intent taşır, misafir lead’e bağlanır', async () => {
    const { executor, commandBus } = build();
    const search = await executor.execute(
      call(AI_TOOL_NAMES.SEARCH_HOTELS, {
        checkIn: '2026-07-01',
        checkOut: '2026-07-05',
        adults: 2,
      }),
      context
    );
    const optionId = JSON.parse(search.content).options[0].optionId;

    const res = await executor.execute(
      call(AI_TOOL_NAMES.BOOK_HOTEL, {
        optionId,
        holderName: 'Ali',
        holderSurname: 'Veli',
      }),
      context
    );

    const body = JSON.parse(res.content);
    // Rezervasyon HEMEN açılmaz; iki ödeme linki döner.
    expect(body.paymentRequired).toBe(true);
    expect(body.tryLink.currency).toBe('TRY');
    expect(body.fxLink.currency).toBe('EUR');
    // Opak rateKey LLM'e SIZMAZ.
    expect(res.content).not.toContain('RK-LONG-OPAQUE-1');

    // Arama adımı CacheHotelRateOptionCommand da dispatch eder; ödeme komutunu ayıkla.
    const cmd = (commandBus.execute as jest.Mock).mock.calls
      .map((c) => c[0])
      .find(
        (c) => c instanceof InitiateBookingPaymentCommand
      ) as InitiateBookingPaymentCommand;
    expect(cmd).toBeInstanceOf(InitiateBookingPaymentCommand);
    expect(cmd.input.bookingType).toBe('HOTEL');
    expect(cmd.input.netAmount).toBe(100);
    expect(cmd.input.netCurrency).toBe('EUR');
    const intent = cmd.input.intent as HotelBookingIntent;
    expect(intent.rooms[0].rateKey).toBe('RK-LONG-OPAQUE-1');
    expect(cmd.input.leadId).toBe('lead-1'); // patientId yok → lead'e bağlandı
    expect(cmd.input.patientId).toBeNull();
  });

  it('book_hotel: optionId cache’te yoksa süresi doldu mesajı', async () => {
    const { executor, commandBus } = build();
    const res = await executor.execute(
      call(AI_TOOL_NAMES.BOOK_HOTEL, {
        optionId: 'ht_yok',
        holderName: 'Ali',
        holderSurname: 'Veli',
      }),
      context
    );
    expect(res.content).toContain('süresi doldu');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('cancel_hotel_booking: yazışmaya ait olmayan rezervasyon reddedilir', async () => {
    const { executor, commandBus } = build({ bookings: [] });
    const res = await executor.execute(
      call(AI_TOOL_NAMES.CANCEL_HOTEL_BOOKING, { bookingId: 'other-booking' }),
      context
    );
    expect(res.content).toContain('doğrulayamadım');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  /**
   * optionId bir **adres**, yetki değil. Başka kiracının teklifiyle ödeme
   * başlatılamaz: hasta kendi gördüğü fiyatı öderken sistem başka kiracının
   * anlaşmalı odasını rezerve ediyor olurdu (defter de o maliyeti yazardı).
   */
  it('book_hotel: BAŞKA kiracının optionId’siyle ödeme başlatılamaz', async () => {
    const { executor, commandBus } = build();
    const search = await executor.execute(
      call(AI_TOOL_NAMES.SEARCH_HOTELS, {
        checkIn: '2026-07-01',
        checkOut: '2026-07-05',
        adults: 2,
      }),
      context
    );
    const { options } = JSON.parse(search.content) as {
      options: { optionId: string }[];
    };
    const optionId = options[0].optionId;
    (commandBus.execute as jest.Mock).mockClear();

    const res = await executor.execute(
      call(AI_TOOL_NAMES.BOOK_HOTEL, {
        optionId,
        holderName: 'Ali',
        holderSurname: 'Veli',
      }),
      { ...context, clinicId: 'clinic-2' }
    );

    expect(res.content).toContain('tekrar arama');
    const payments = (commandBus.execute as jest.Mock).mock.calls.filter(
      ([c]) => c instanceof InitiateBookingPaymentCommand
    );
    expect(payments).toHaveLength(0);
  });

  it('book_hotel: aynı kiracıda BAŞKA görüşmenin optionId’si reddedilir', async () => {
    const { executor, commandBus, alarms } = build();
    const search = await executor.execute(
      call(AI_TOOL_NAMES.SEARCH_HOTELS, {
        checkIn: '2026-07-01',
        checkOut: '2026-07-05',
        adults: 2,
      }),
      context
    );
    const { options } = JSON.parse(search.content) as {
      options: { optionId: string }[];
    };
    const optionId = options[0].optionId;
    (commandBus.execute as jest.Mock).mockClear();

    const res = await executor.execute(
      call(AI_TOOL_NAMES.BOOK_HOTEL, {
        optionId,
        holderName: 'Ali',
        holderSurname: 'Veli',
      }),
      { ...context, conversationId: 'conv-9' }
    );

    expect(res.content).toContain('tekrar arama');
    expect(alarms).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'WARNING' })
    );
    const payments = (commandBus.execute as jest.Mock).mock.calls.filter(
      ([c]) => c instanceof InitiateBookingPaymentCommand
    );
    expect(payments).toHaveLength(0);
  });
});
