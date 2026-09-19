import { ConfigService } from '@nestjs/config';
import { DuffelApiService } from './duffel-api.service';
import {
  DuffelApiException,
  DuffelCredentialsMissingException,
} from '@modules/crm/health-tourism/flight/domain/exceptions/duffel-flight.exceptions';

// SDK'yı taklit et: gerçek HTTP çağrısı yapılmadan eşleme ve hata yolları ölçülür.
const mockOfferRequestsCreate = jest.fn();
const mockOffersGet = jest.fn();
const mockOrdersCreate = jest.fn();
const mockOrdersGet = jest.fn();

jest.mock('@duffel/api', () => ({
  Duffel: jest.fn().mockImplementation(() => ({
    offerRequests: { create: mockOfferRequestsCreate },
    offers: { get: mockOffersGet },
    orders: { create: mockOrdersCreate, get: mockOrdersGet },
    payments: { create: jest.fn() },
    orderCancellations: { create: jest.fn(), confirm: jest.fn() },
  })),
}));

const rawOffer = (overrides: Record<string, unknown> = {}) => ({
  id: 'off_1',
  total_amount: '349.90',
  total_currency: 'EUR',
  expires_at: '2026-09-01T10:00:00Z',
  owner: { name: 'Duffel Airways', iata_code: 'ZZ' },
  payment_requirements: {
    requires_instant_payment: false,
    payment_required_by: '2026-08-30T10:00:00Z',
    price_guarantee_expires_at: null,
  },
  slices: [
    {
      origin: { iata_code: 'FRA', name: 'Frankfurt' },
      destination: { iata_code: 'IST', name: 'Istanbul' },
      duration: 'PT3H15M',
      segments: [
        {
          origin: { iata_code: 'FRA', name: 'Frankfurt' },
          destination: { iata_code: 'IST', name: 'Istanbul' },
          departing_at: '2026-09-10T09:15:00',
          arriving_at: '2026-09-10T13:05:00',
          marketing_carrier: { iata_code: 'TK', name: 'Turkish Airlines' },
          marketing_carrier_flight_number: '1988',
        },
      ],
    },
  ],
  ...overrides,
});

// NOT: token'ı `undefined` geçmek varsayılan parametreyi tetiklerdi; eksik token
// senaryosu bu yüzden ayrı bir kurucuyla ifade edilir.
const buildService = (token = 'duffel_test_abc') => {
  const config = {
    get: jest.fn().mockReturnValue(token),
  } as unknown as ConfigService;
  return new DuffelApiService(config);
};

/** Mock çağrısının gövdesini tipli okur (spec'te `any` sızmasın). */
const lastCallBody = (mock: jest.Mock): Record<string, unknown> =>
  mock.mock.calls[0][0] as Record<string, unknown>;

const buildServiceWithoutToken = () => {
  const config = {
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as ConfigService;
  return new DuffelApiService(config);
};

const searchParams = {
  originIata: 'FRA',
  destinationIata: 'IST',
  departureDate: '2026-09-10',
  adults: 1,
  children: 0,
  infants: 0,
  cabinClass: 'economy' as const,
};

beforeEach(() => jest.clearAllMocks());

describe('DuffelApiService — kimlik', () => {
  it('token yoksa ilk çağrıda DuffelCredentialsMissingException fırlatır', async () => {
    const service = buildServiceWithoutToken();

    await expect(service.searchOffers(searchParams)).rejects.toBeInstanceOf(
      DuffelCredentialsMissingException
    );
    // Uygulama açılışında değil, yalnız kullanım anında patlar.
    expect(mockOfferRequestsCreate).not.toHaveBeenCalled();
  });
});

describe('DuffelApiService — teklif eşlemesi', () => {
  it('Duffel teklifini domain read-model’ine çevirir', async () => {
    mockOfferRequestsCreate.mockResolvedValue({
      data: { offers: [rawOffer()] },
    });

    const [offer] = await buildService().searchOffers(searchParams);

    expect(offer.offerId).toBe('off_1');
    expect(offer.totalAmount).toBe(349.9);
    expect(offer.currency).toBe('EUR');
    expect(offer.requiresInstantPayment).toBe(false);
    expect(offer.paymentRequiredBy).toBe('2026-08-30T10:00:00Z');
    expect(offer.slices[0].durationMinutes).toBe(195);
    expect(offer.slices[0].segments[0].flightNumber).toBe('1988');
    expect(offer.slices[0].segments[0].carrierIata).toBe('TK');
  });

  it('gidiş-dönüş aramasında iki slice gönderir', async () => {
    mockOfferRequestsCreate.mockResolvedValue({ data: { offers: [] } });

    await buildService().searchOffers({
      ...searchParams,
      returnDate: '2026-09-20',
    });

    const body = lastCallBody(mockOfferRequestsCreate);
    const slices = body.slices as Array<Record<string, unknown>>;
    expect(slices).toHaveLength(2);
    expect(slices[1]).toMatchObject({
      origin: 'IST',
      destination: 'FRA',
      departure_date: '2026-09-20',
    });
  });

  it('payment_requirements yoksa güvenli tarafta kalır (instant kabul eder)', async () => {
    mockOfferRequestsCreate.mockResolvedValue({
      data: { offers: [rawOffer({ payment_requirements: undefined })] },
    });

    const [offer] = await buildService().searchOffers(searchParams);

    // Bilinmiyorsa hold denenmez: yanlışlıkla tutulamayan koltuk, yanlışlıkla
    // kaybedilen ödemeden iyidir.
    expect(offer.requiresInstantPayment).toBe(true);
  });
});

describe('DuffelApiService — para birimi kapısı', () => {
  it('desteklenmeyen para birimindeki teklifleri eler (sessizce yanlış kolona yazmaz)', async () => {
    mockOfferRequestsCreate.mockResolvedValue({
      data: {
        offers: [
          rawOffer({ id: 'off_chf', total_currency: 'CHF' }),
          rawOffer({ id: 'off_eur', total_currency: 'EUR' }),
        ],
      },
    });

    const offers = await buildService().searchOffers(searchParams);

    expect(offers).toHaveLength(1);
    expect(offers[0].offerId).toBe('off_eur');
  });

  it('hepsi desteklenmiyorsa boş liste döner', async () => {
    mockOfferRequestsCreate.mockResolvedValue({
      data: { offers: [rawOffer({ total_currency: 'JPY' })] },
    });

    await expect(buildService().searchOffers(searchParams)).resolves.toEqual(
      []
    );
  });
});

describe('DuffelApiService — hata eşlemesi', () => {
  it('sağlayıcı hatasını DuffelApiException’a çevirir (ham Error sızmaz)', async () => {
    mockOfferRequestsCreate.mockRejectedValue({
      errors: [{ message: 'Invalid origin' }],
    });

    await expect(
      buildService().searchOffers(searchParams)
    ).rejects.toBeInstanceOf(DuffelApiException);
  });

  it('sağlayıcı mesajını meta’da taşır', async () => {
    mockOfferRequestsCreate.mockRejectedValue({
      errors: [{ message: 'Invalid origin' }],
    });

    await expect(
      buildService().searchOffers(searchParams)
    ).rejects.toMatchObject({
      meta: { operation: 'searchOffers', providerMessage: 'Invalid origin' },
    });
  });

  it('bayatlamış teklif (404) hata değil, null döner', async () => {
    mockOffersGet.mockRejectedValue({ meta: { status: 404 } });

    await expect(buildService().getOffer('off_gone')).resolves.toBeNull();
  });
});

describe('DuffelApiService — sipariş açma', () => {
  it('hold siparişi pay_later tipiyle ve ödemesiz gönderilir', async () => {
    mockOrdersCreate.mockResolvedValue({
      data: {
        id: 'ord_1',
        booking_reference: 'PNR123',
        total_amount: '349.90',
        total_currency: 'EUR',
        payment_status: { payment_required_by: '2026-08-30T10:00:00Z' },
      },
    });

    const result = await buildService().createHoldOrder({
      offerId: 'off_1',
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
    });

    const body = lastCallBody(mockOrdersCreate);
    expect(body.type).toBe('pay_later');
    expect(body.payments).toBeUndefined();
    expect(
      (body.passengers as Array<Record<string, unknown>>)[0]
    ).toMatchObject({
      given_name: 'Ada',
      family_name: 'Lovelace',
      born_on: '1990-01-01',
    });
    expect(result).toMatchObject({
      orderId: 'ord_1',
      bookingReference: 'PNR123',
      paymentRequiredBy: '2026-08-30T10:00:00Z',
    });
  });
});

describe('DuffelApiService — sipariş durumu (ödeme mutabakatı)', () => {
  it('awaiting_payment=false ise sipariş ÖDENMİŞ sayılır', async () => {
    mockOrdersGet.mockResolvedValue({
      data: {
        id: 'ord_1',
        booking_reference: 'PNR123',
        payment_status: { awaiting_payment: false },
        cancelled_at: null,
      },
    });

    await expect(buildService().getOrderState('ord_1')).resolves.toEqual({
      orderId: 'ord_1',
      bookingReference: 'PNR123',
      isPaid: true,
      isCancelled: false,
    });
  });

  it('awaiting_payment=true ise ödenmemiş sayılır', async () => {
    mockOrdersGet.mockResolvedValue({
      data: {
        id: 'ord_1',
        booking_reference: 'PNR123',
        payment_status: { awaiting_payment: true },
        cancelled_at: null,
      },
    });

    const state = await buildService().getOrderState('ord_1');

    expect(state?.isPaid).toBe(false);
  });

  it('payment_status hiç yoksa ödenmiş VARSAYILMAZ', async () => {
    // Belirsizlik "ödendi"ye çevrilirse ödenmemiş bir bilet onaylanır.
    mockOrdersGet.mockResolvedValue({
      data: { id: 'ord_1', booking_reference: null, cancelled_at: null },
    });

    const state = await buildService().getOrderState('ord_1');

    expect(state?.isPaid).toBe(false);
  });

  it('sipariş yoksa (404) null döner', async () => {
    mockOrdersGet.mockRejectedValue({ meta: { status: 404 } });

    await expect(buildService().getOrderState('ord_yok')).resolves.toBeNull();
  });

  it('sağlayıcı hatası DuffelApiException olarak yükselir (sessizce yutulmaz)', async () => {
    mockOrdersGet.mockRejectedValue({ errors: [{ message: 'boom' }] });

    await expect(
      buildService().getOrderState('ord_1')
    ).rejects.toBeInstanceOf(DuffelApiException);
  });
});
