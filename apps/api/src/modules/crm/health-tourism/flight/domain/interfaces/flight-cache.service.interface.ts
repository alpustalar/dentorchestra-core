import { FlightOfferToken } from '@modules/crm/health-tourism/flight/domain/contracts';

export const FLIGHT_CACHE_SERVICE = Symbol('IFlightCacheService');

/**
 * Uçuş modülünün cache sözleşmesi. Otel/transferdeki gibi **jenerik değil, somut**
 * (`get<T>` çağıranı cast'e zorluyor, cast'i silen bir lint autofix'i derlemeyi
 * bozabiliyordu).
 */
export interface IFlightCacheService {
  readonly flightOffer: {
    /**
     * Kayıt yoksa, süresi dolduysa veya bozuk JSON ise `null`. Anahtar kiracı
     * kapsamlıdır: başka kliniğin optionId'si burada bulunmaz.
     */
    get(clinicId: string, token: string): Promise<FlightOfferToken | null>;
    /**
     * `ttlSeconds` verilmezse teklifin kendi `expiresAt`'inden hesaplanır.
     * Uçuş teklifleri otel fiyatlarından çok daha hızlı bayatladığı için sabit
     * 15 dakika kullanılmaz.
     */
    set(
      token: string,
      data: FlightOfferToken,
      ttlSeconds?: number
    ): Promise<void>;
  };
}
