import { HotelRateOptionToken } from '@modules/crm/health-tourism/hotel/domain/contracts';

export const HOTEL_CACHE_SERVICE = Symbol('IHotelCacheService');

/**
 * Otel modülünün cache sözleşmesi. Tipler **jenerik değil, somut**: `get<T = unknown>`
 * imzası çağıranı tip argümanı geçmeye ya da dönüşü cast etmeye zorlar; cast'i silen
 * bir lint autofix'i de kodu sessizce bozabilir. Sözleşme burada bağlandığı için
 * çağıran doğrudan `HotelRateOptionToken | null` alır.
 */
export interface IHotelCacheService {
  readonly hotelRateOption: {
    /** Token yoksa veya bozuk JSON ise `null`. Anahtar kiracı kapsamlıdır. */
    get(clinicId: string, token: string): Promise<HotelRateOptionToken | null>;
    set(
      token: string,
      data: HotelRateOptionToken,
      ttlSeconds?: number
    ): Promise<void>;
  };
}
