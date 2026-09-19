import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';
import { IFlightCacheService } from '@modules/crm/health-tourism/flight/domain/interfaces/flight-cache.service.interface';

const KEYS = {
  // AI asistanı için kısa optionId → Duffel offer id + bağlam.
  OFFER: (token: string) => `flight:offer:${token}`,
};

/** Teklif hiç bayatlamayacakmış gibi görünse bile üst sınır. */
const MAX_TTL_SECONDS = DateTimeManager.toSeconds({ minutes: 10 });
/** Bu eşiğin altında kalan teklif zaten kullanılamaz; en az bu kadar tutulur. */
const MIN_TTL_SECONDS = 30;

@Injectable()
export class FlightCacheService implements IFlightCacheService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  get flightOffer() {
    return {
      set: async (
        token: string,
        data: FlightOfferToken,
        ttlSeconds?: number
      ): Promise<void> => {
        const ttl = ttlSeconds ?? deriveTtlFromOffer(data.expiresAt);
        await this.redis.set(
          KEYS.OFFER(token),
          JSON.stringify(data),
          'EX',
          ttl
        );
      },
      get: async (token: string): Promise<FlightOfferToken | null> => {
        const raw = await this.redis.get(KEYS.OFFER(token));
        if (!raw) return null;
        try {
          return JSON.parse(raw) as FlightOfferToken;
        } catch {
          return null;
        }
      },
    };
  }
}

/**
 * TTL teklifin kendi son kullanma anından türetilir: Duffel teklifleri dakikalar
 * içinde bayatlayabildiği için sabit bir süre tutmak, hastaya ödeme linki
 * gönderdikten sonra "teklif yok" hatası almak demektir.
 */
function deriveTtlFromOffer(expiresAt: string): number {
  const remaining = DateTimeManager.diffInSeconds(
    new Date(expiresAt),
    DateTimeManager.create()
  );

  if (!Number.isFinite(remaining) || remaining <= 0) return MIN_TTL_SECONDS;
  return Math.max(MIN_TTL_SECONDS, Math.min(remaining, MAX_TTL_SECONDS));
}
