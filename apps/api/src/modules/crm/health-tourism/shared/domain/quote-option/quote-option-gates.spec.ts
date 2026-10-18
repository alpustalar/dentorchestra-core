import { CriticalFailurePublisher } from '@common/observability/critical-failure.publisher';
import { QuoteOptionOwnershipService } from './quote-option-ownership.service';
import { QuoteOptionRejectedException } from './quote-option-rejected.exception';
import { QuoteOptionOwner } from './quote-option.contracts';
import { GetHotelRateOptionHandler } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-rate-option/get-hotel-rate-option.handler';
import { GetHotelRateOptionQuery } from '@modules/crm/health-tourism/hotel/application/queries/get-hotel-rate-option/get-hotel-rate-option.query';
import { GetTransferRateOptionHandler } from '@modules/crm/health-tourism/transfer/application/queries/get-transfer-rate-option/get-transfer-rate-option.handler';
import { GetTransferRateOptionQuery } from '@modules/crm/health-tourism/transfer/application/queries/get-transfer-rate-option/get-transfer-rate-option.query';
import { GetFlightOfferHandler } from '@modules/crm/health-tourism/flight/application/queries/get-flight-offer/get-flight-offer.handler';
import { GetFlightOfferQuery } from '@modules/crm/health-tourism/flight/application/queries/get-flight-offer/get-flight-offer.query';

const owner: QuoteOptionOwner = {
  clinicId: 'clinic-1',
  conversationId: 'conv-1',
};

/** Kapı yalnız `owner` alanına bakar; dikeye özgü alanlar burada önemsiz. */
const someToken = { owner, net: 100, currency: 'EUR' };

interface Gate {
  name: string;
  /** Okuma kapısını kurar; `stored` önbellekte duran kayıt (null = kayıt yok). */
  build: (
    stored: unknown,
    ownership: QuoteOptionOwnershipService
  ) => {
    execute: (optionId: string, claimClinicId: string) => Promise<unknown>;
    get: jest.Mock;
  };
}

/**
 * Üç dikeyin okuma kapısı **aynı** davranmak zorundadır: teklif kiracı kapsamlı
 * anahtarla okunur, kayıt yoksa `null` döner (uyarı yok), kayıt varsa sahiplik
 * doğrulanır. Dikeyi ayrı ayrı test etmezsek, dördüncü dikey eklendiğinde
 * kapısız doğması kimseye görünmez.
 */
const gates: Gate[] = [
  {
    name: 'HOTEL',
    build: (stored, ownership) => {
      const get = jest.fn().mockResolvedValue(stored);
      const handler = new GetHotelRateOptionHandler(
        { hotelRateOption: { get, set: jest.fn() } } as never,
        ownership
      );
      return {
        get,
        execute: (optionId, clinicId) =>
          handler.execute(
            new GetHotelRateOptionQuery(optionId, {
              clinicId,
              conversationId: owner.conversationId,
            })
          ),
      };
    },
  },
  {
    name: 'TRANSFER',
    build: (stored, ownership) => {
      const get = jest.fn().mockResolvedValue(stored);
      const handler = new GetTransferRateOptionHandler(
        {
          transferAvailability: { get: jest.fn(), set: jest.fn() },
          transferRateOption: { get, set: jest.fn() },
        } as never,
        ownership
      );
      return {
        get,
        execute: (optionId, clinicId) =>
          handler.execute(
            new GetTransferRateOptionQuery(optionId, {
              clinicId,
              conversationId: owner.conversationId,
            })
          ),
      };
    },
  },
  {
    name: 'FLIGHT',
    build: (stored, ownership) => {
      const get = jest.fn().mockResolvedValue(stored);
      const handler = new GetFlightOfferHandler(
        { flightOffer: { get, set: jest.fn() } } as never,
        ownership
      );
      return {
        get,
        execute: (optionId, clinicId) =>
          handler.execute(
            new GetFlightOfferQuery(optionId, {
              clinicId,
              conversationId: owner.conversationId,
            })
          ),
      };
    },
  },
];

describe.each(gates)('teklif okuma kapısı — $name', (gate) => {
  let publish: jest.Mock;
  let ownership: QuoteOptionOwnershipService;

  beforeEach(() => {
    publish = jest.fn();
    ownership = new QuoteOptionOwnershipService({
      publish,
    } as unknown as CriticalFailurePublisher);
  });

  it('önbellek kiracı kapsamlı anahtarla okunur', async () => {
    const { execute, get } = gate.build({ ...someToken }, ownership);

    await execute('opt-1', 'clinic-1');

    expect(get).toHaveBeenCalledWith('clinic-1', 'opt-1');
  });

  it('kayıt yoksa null döner ve uyarı üretilmez (süresi dolmuş teklif)', async () => {
    const { execute } = gate.build(null, ownership);

    await expect(execute('opt-1', 'clinic-1')).resolves.toEqual({ data: null });
    expect(publish).not.toHaveBeenCalled();
  });

  it('kayıt başka kiracıya aitse reddedilir', async () => {
    const { execute } = gate.build(
      {
        ...someToken,
        owner: { clinicId: 'clinic-9', conversationId: 'conv-1' },
      },
      ownership
    );

    await expect(execute('opt-1', 'clinic-1')).rejects.toThrow(
      QuoteOptionRejectedException
    );
  });

  it('kayıtta sahip bilgisi yoksa reddedilir (fail-closed)', async () => {
    const { execute } = gate.build(
      { ...someToken, owner: undefined },
      ownership
    );

    await expect(execute('opt-1', 'clinic-1')).rejects.toThrow(
      QuoteOptionRejectedException
    );
  });

  it('sahip uyuşuyorsa teklif döner', async () => {
    const token = { ...someToken };
    const { execute } = gate.build(token, ownership);

    await expect(execute('opt-1', 'clinic-1')).resolves.toEqual({
      data: token,
    });
  });
});
