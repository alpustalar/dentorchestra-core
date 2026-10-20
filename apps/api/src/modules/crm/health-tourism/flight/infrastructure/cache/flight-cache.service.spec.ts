import Redis from 'ioredis';
import { FlightCacheService } from './flight-cache.service';
import { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';

const tokenWithExpiry = (expiresAt: string): FlightOfferToken =>
  ({
    owner: { clinicId: 'clinic-1', conversationId: 'conv-1' },
    offerId: 'off_1',
    totalAmount: 100,
    currency: 'EUR',
    requiresInstantPayment: false,
    paymentRequiredBy: null,
    expiresAt,
    ownerName: 'TK',
    summary: 'TK1988',
    originIata: 'FRA',
    destinationIata: 'IST',
    departingAt: '2026-09-10T09:15:00',
    slices: [],
  }) as FlightOfferToken;

const build = () => {
  const redis = {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn(),
  } as unknown as Redis;
  return { service: new FlightCacheService(redis), redis };
};

const ttlOfLastSet = (redis: Redis): number => {
  const args = (redis.set as jest.Mock).mock.calls[0] as unknown[];
  return args[3] as number;
};

describe('FlightCacheService — TTL teklifin ömründen türetilir', () => {
  it('teklif 4 dakika sonra bayatlıyorsa TTL ~4 dakikadır (sabit 15 dk DEĞİL)', async () => {
    const { service, redis } = build();
    const expiresAt = DateTimeManager.addMinutes(
      DateTimeManager.create(),
      4
    ).toISOString();

    await service.flightOffer.set('fl_1', tokenWithExpiry(expiresAt));

    const ttl = ttlOfLastSet(redis);
    expect(ttl).toBeGreaterThan(200);
    expect(ttl).toBeLessThanOrEqual(240);
  });

  it('çok uzun ömürlü teklifte TTL üst sınırla (10 dk) kırpılır', async () => {
    const { service, redis } = build();
    const expiresAt = DateTimeManager.addMinutes(
      DateTimeManager.create(),
      120
    ).toISOString();

    await service.flightOffer.set('fl_1', tokenWithExpiry(expiresAt));

    expect(ttlOfLastSet(redis)).toBe(600);
  });

  it('süresi geçmiş teklifte alt sınıra düşer (negatif TTL Redis’i patlatırdı)', async () => {
    const { service, redis } = build();
    const expiresAt = DateTimeManager.addMinutes(
      DateTimeManager.create(),
      -5
    ).toISOString();

    await service.flightOffer.set('fl_1', tokenWithExpiry(expiresAt));

    expect(ttlOfLastSet(redis)).toBe(30);
  });

  it('açıkça verilen ttlSeconds hesaplamayı ezer', async () => {
    const { service, redis } = build();

    await service.flightOffer.set(
      'fl_1',
      tokenWithExpiry(DateTimeManager.create().toISOString()),
      42
    );

    expect(ttlOfLastSet(redis)).toBe(42);
  });
});

describe('FlightCacheService — anahtar kapsamı', () => {
  /**
   * Anahtarın kiracısı **kaydın sahibinden** gelir: ikisi ayrışırsa bir kliniğin
   * teklifi başka kliniğin kapsamında aranabilir hale gelirdi.
   */
  it('yazma anahtarı kaydın sahibiyle kiracı kapsamlı kurulur', async () => {
    const { service, redis } = build();
    const token = tokenWithExpiry('2099-01-01T00:00:00Z');

    await service.flightOffer.set('fl_1', token);

    const [key] = (redis.set as jest.Mock).mock.calls[0] as [string];
    expect(key).toBe('flight:offer:clinic-1:fl_1');
  });

  it('okuma anahtarı çağıranın kliniğiyle kurulur', async () => {
    const { service, redis } = build();
    (redis.get as jest.Mock).mockResolvedValue(null);

    await service.flightOffer.get('clinic-2', 'fl_1');

    expect(redis.get).toHaveBeenCalledWith('flight:offer:clinic-2:fl_1');
  });
});

describe('FlightCacheService — okuma', () => {
  it('kayıt yoksa null döner', async () => {
    const { service, redis } = build();
    (redis.get as jest.Mock).mockResolvedValue(null);

    await expect(
      service.flightOffer.get('clinic-1', 'fl_yok')
    ).resolves.toBeNull();
  });

  it('bozuk JSON’da patlamaz, null döner', async () => {
    const { service, redis } = build();
    (redis.get as jest.Mock).mockResolvedValue('{bozuk');

    await expect(
      service.flightOffer.get('clinic-1', 'fl_1')
    ).resolves.toBeNull();
  });

  it('kayıtlı token’ı geri verir', async () => {
    const { service, redis } = build();
    const token = tokenWithExpiry('2026-09-01T10:00:00Z');
    (redis.get as jest.Mock).mockResolvedValue(JSON.stringify(token));

    await expect(
      service.flightOffer.get('clinic-1', 'fl_1')
    ).resolves.toMatchObject({
      offerId: 'off_1',
    });
  });
});
