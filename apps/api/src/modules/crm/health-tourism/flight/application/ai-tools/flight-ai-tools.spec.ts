import { SearchFlightsTool } from './search-flights.tool';
import { BookFlightTool } from './book-flight.tool';
import { CancelFlightBookingTool } from './cancel-flight-booking.tool';
import { CacheFlightOfferCommand } from '@modules/crm/health-tourism/flight/application/commands/cache-flight-offer/cache-flight-offer.command';
import { HoldFlightCommand } from '@modules/crm/health-tourism/flight/application/commands/hold-flight/hold-flight.command';
import { CancelFlightBookingCommand } from '@modules/crm/health-tourism/flight/application/commands/cancel-flight-booking/cancel-flight-booking.command';
import { InitiateBookingPaymentCommand } from '@modules/crm/health-tourism/booking-payment/application/commands/initiate-booking-payment/initiate-booking-payment.command';
import { TSCommandBus } from '@common/cqrs/type-safe-command-bus';
import { TSQueryBus } from '@common/cqrs/type-safe-query-bus';
import { AiToolSupport } from '@modules/platform/ai-tools/application/ai-tool.support';
import { AiToolContext } from '@common/ai-tools';
import { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';

const CLINIC_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';

const context: AiToolContext = {
  clinicId: CLINIC_ID,
  organizationId: ORG_ID,
  patientId: null,
  leadId: 'lead-1',
  conversationId: 'conv-1',
} as unknown as AiToolContext;

const OFFER = {
  offerId: 'off_SECRET_DUFFEL_ID',
  totalAmount: 349.9,
  currency: 'EUR' as const,
  expiresAt: '2026-09-01T10:00:00Z',
  requiresInstantPayment: false,
  paymentRequiredBy: '2026-08-30T10:00:00Z',
  priceGuaranteeExpiresAt: null,
  ownerName: 'Turkish Airlines',
  ownerIata: 'TK',
  slices: [
    {
      originIata: 'FRA',
      destinationIata: 'IST',
      durationMinutes: 195,
      segments: [
        {
          originIata: 'FRA',
          originName: 'Frankfurt',
          destinationIata: 'IST',
          destinationName: 'Istanbul',
          departingAt: '2026-09-10T09:15:00',
          arrivingAt: '2026-09-10T13:05:00',
          carrierIata: 'TK',
          carrierName: 'Turkish Airlines',
          flightNumber: '1988',
        },
      ],
    },
  ],
};

const buildSupport = (
  config: unknown = { isEnabled: true, airportIata: 'IST' }
) =>
  ({
    buildClinicContext: jest.fn().mockReturnValue({
      actor: { userId: 'sys', clinicId: CLINIC_ID, organizationId: ORG_ID },
      source: 'INTERNAL_CASCADE',
    }),
    getHealthTourismConfig: jest.fn().mockResolvedValue(config),
    loadOwnedFlightBookings: jest.fn().mockResolvedValue([]),
    refundForCancelledBooking: jest.fn().mockResolvedValue(true),
    renderPaymentLinks: jest.fn().mockReturnValue({ content: 'links' }),
  }) as unknown as AiToolSupport;

describe('SearchFlightsTool', () => {
  it('Duffel offer_id LLM çıktısına SIZMAZ; yalnız kısa optionId döner', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: [OFFER] }),
    } as unknown as TSQueryBus;

    const tool = new SearchFlightsTool(commandBus, queryBus, buildSupport());
    const result = await tool.execute(
      { origin: 'FRA', departureDate: '2026-09-10', adults: 1 },
      context
    );

    expect(result.content).not.toContain('off_SECRET_DUFFEL_ID');
    const parsed = JSON.parse(result.content);
    expect(parsed.options[0].optionId).toMatch(/^fl_[0-9a-f]{8}$/);
    expect(parsed.options[0]).not.toHaveProperty('offerId');
  });

  it('opak offer_id cache’e mühürlenir (bus üzerinden, Redis’e doğrudan değil)', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: [OFFER] }),
    } as unknown as TSQueryBus;

    const tool = new SearchFlightsTool(commandBus, queryBus, buildSupport());
    await tool.execute(
      { origin: 'FRA', departureDate: '2026-09-10', adults: 1 },
      context
    );

    const cacheCmd = (commandBus.execute as jest.Mock).mock.calls
      .map(([c]) => c)
      .find((c) => c instanceof CacheFlightOfferCommand);

    expect(cacheCmd?.token.offerId).toBe('off_SECRET_DUFFEL_ID');
  });

  it('varış havalimanı klinik ayarından gelir; hastaya sorulmaz', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: [OFFER] }),
    } as unknown as TSQueryBus;

    const tool = new SearchFlightsTool(commandBus, queryBus, buildSupport());
    await tool.execute(
      { origin: 'fra', departureDate: '2026-09-10', adults: 1 },
      context
    );

    const [query] = (queryBus.execute as jest.Mock).mock.calls[0];
    expect(query.filter.destination).toBe('IST');
    expect(query.filter.origin).toBe('FRA');
  });

  it('klinik uçuş için yapılandırılmamışsa arama yapılmaz', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const queryBus = { execute: jest.fn() } as unknown as TSQueryBus;

    const tool = new SearchFlightsTool(
      commandBus,
      queryBus,
      buildSupport({ isEnabled: true, airportIata: null })
    );
    const result = await tool.execute(
      { origin: 'FRA', departureDate: '2026-09-10', adults: 1 },
      context
    );

    expect(result.content).toContain('havalimanı');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});

describe('BookFlightTool — hibrit karar', () => {
  const passengers = [
    {
      type: 'adult',
      givenName: 'Ada',
      familyName: 'Lovelace',
      bornOn: '1990-01-01',
    },
  ];
  const input = {
    optionId: 'fl_abcd1234',
    passengers,
    contactEmail: 'ada@example.com',
    contactPhone: '+905550000000',
  };

  const tokenOf = (
    overrides: Partial<FlightOfferToken> = {}
  ): FlightOfferToken =>
    ({
      offerId: 'off_1',
      totalAmount: 349.9,
      currency: 'EUR',
      requiresInstantPayment: false,
      paymentRequiredBy: '2026-08-30T10:00:00Z',
      expiresAt: '2026-09-01T10:00:00Z',
      ownerName: 'Turkish Airlines',
      summary: 'TK1988 · FRA → IST',
      originIata: 'FRA',
      destinationIata: 'IST',
      departingAt: '2026-09-10T09:15:00',
      slices: [],
      ...overrides,
    }) as FlightOfferToken;

  it('hold’a uygun teklifte koltuk ÖNCE tutulur, sonra ödeme başlatılır', async () => {
    const commandBus = {
      execute: jest.fn(async (cmd: unknown) => {
        if (cmd instanceof HoldFlightCommand) {
          return {
            bookingId: 'bk-1',
            duffelOrderId: 'ord_1',
            paymentRequiredBy: '2026-08-30T10:00:00Z',
          };
        }
        return { iyzico: null, stripe: null };
      }),
    } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: tokenOf() }),
    } as unknown as TSQueryBus;

    const tool = new BookFlightTool(commandBus, queryBus, buildSupport());
    await tool.execute(input, context);

    const calls = (commandBus.execute as jest.Mock).mock.calls.map(([c]) => c);
    const holdIndex = calls.findIndex((c) => c instanceof HoldFlightCommand);
    const payIndex = calls.findIndex(
      (c) => c instanceof InitiateBookingPaymentCommand
    );

    expect(holdIndex).toBeGreaterThanOrEqual(0);
    expect(payIndex).toBeGreaterThan(holdIndex);

    const initiate = calls[payIndex] as InitiateBookingPaymentCommand;
    expect(initiate.input.intent).toMatchObject({
      type: 'FLIGHT',
      mode: 'HOLD',
      flightBookingId: 'bk-1',
      duffelOrderId: 'ord_1',
    });
  });

  it('anında ödeme isteyen teklifte hold denenmez; INSTANT niyet üretilir', async () => {
    const commandBus = {
      execute: jest.fn().mockResolvedValue({ iyzico: null, stripe: null }),
    } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest
        .fn()
        .mockResolvedValue({ data: tokenOf({ requiresInstantPayment: true }) }),
    } as unknown as TSQueryBus;

    const tool = new BookFlightTool(commandBus, queryBus, buildSupport());
    await tool.execute(input, context);

    const calls = (commandBus.execute as jest.Mock).mock.calls.map(([c]) => c);
    expect(calls.some((c) => c instanceof HoldFlightCommand)).toBe(false);

    const initiate = calls.find(
      (c) => c instanceof InitiateBookingPaymentCommand
    ) as InitiateBookingPaymentCommand;
    expect(initiate.input.intent).toMatchObject({
      type: 'FLIGHT',
      mode: 'INSTANT',
      optionId: 'fl_abcd1234',
    });
  });

  it('hold başarısız olursa akış durmaz, INSTANT yola düşülür', async () => {
    const commandBus = {
      execute: jest.fn(async (cmd: unknown) => {
        if (cmd instanceof HoldFlightCommand) throw new Error('duffel down');
        return { iyzico: null, stripe: null };
      }),
    } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: tokenOf() }),
    } as unknown as TSQueryBus;

    const tool = new BookFlightTool(commandBus, queryBus, buildSupport());
    await tool.execute(input, context);

    const initiate = (commandBus.execute as jest.Mock).mock.calls
      .map(([c]) => c)
      .find(
        (c) => c instanceof InitiateBookingPaymentCommand
      ) as InitiateBookingPaymentCommand;

    expect(initiate.input.intent).toMatchObject({ mode: 'INSTANT' });
  });

  it('süresi dolmuş optionId ile rezervasyon başlatılmaz', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const queryBus = {
      execute: jest.fn().mockResolvedValue({ data: null }),
    } as unknown as TSQueryBus;

    const tool = new BookFlightTool(commandBus, queryBus, buildSupport());
    const result = await tool.execute(input, context);

    expect(result.content).toContain('süresi doldu');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('yolcu doğum tarihi eksikse reddedilir (havayolu bileti kimliksiz kesilemez)', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const queryBus = { execute: jest.fn() } as unknown as TSQueryBus;

    const tool = new BookFlightTool(commandBus, queryBus, buildSupport());
    const result = await tool.execute(
      {
        ...input,
        passengers: [{ givenName: 'Ada', familyName: 'Lovelace' }],
      },
      context
    );

    expect(result.content).toContain('doğum tarihi');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});

describe('CancelFlightBookingTool — sahiplik', () => {
  it('başkasının rezervasyonu iptal edilemez', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const support = buildSupport();
    (support.loadOwnedFlightBookings as jest.Mock).mockResolvedValue([
      { id: 'baskasinin-kaydi' },
    ]);

    const tool = new CancelFlightBookingTool(commandBus, support);
    const result = await tool.execute({ bookingId: 'benim-degil' }, context);

    expect(result.content).toContain('doğrulayamadım');
    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('kendi rezervasyonu iptal edilir ve iade tetiklenir', async () => {
    const commandBus = { execute: jest.fn() } as unknown as TSCommandBus;
    const support = buildSupport();
    (support.loadOwnedFlightBookings as jest.Mock).mockResolvedValue([
      { id: 'bk-1' },
    ]);

    const tool = new CancelFlightBookingTool(commandBus, support);
    await tool.execute({ bookingId: 'bk-1' }, context);

    const cancelCmd = (commandBus.execute as jest.Mock).mock.calls
      .map(([c]) => c)
      .find((c) => c instanceof CancelFlightBookingCommand);

    expect(cancelCmd).toBeDefined();
    expect(support.refundForCancelledBooking).toHaveBeenCalledWith('bk-1');
  });
});
