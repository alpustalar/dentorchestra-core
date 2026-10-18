import {
  TransferAvailabilityItem,
  TransferRateOptionToken,
} from '@modules/crm/health-tourism/transfer/domain/contracts/hotelbeds-transfer-booking';

export const TRANSFER_CACHE_SERVICE = Symbol('ITransferCacheService');

/**
 * Transfer modülünün cache sözleşmesi. Tipler **jenerik değil, somut** — gerekçe
 * `IHotelCacheService`'teki ile aynı: `get<T = unknown>` dönüşü çağıranda cast'e
 * zorluyordu, cast'i silen bir lint autofix'i de derlemeyi bozabiliyordu.
 */
export interface ITransferCacheService {
  readonly transferAvailability: {
    /** Kayıt yoksa veya bozuk JSON ise `null`. */
    get(paramsHash: string): Promise<TransferAvailabilityItem[] | null>;
    set(paramsHash: string, data: TransferAvailabilityItem[]): Promise<void>;
  };

  readonly transferRateOption: {
    /** Anahtar kiracı kapsamlıdır: başka kliniğin optionId'si burada bulunmaz. */
    get(
      clinicId: string,
      token: string
    ): Promise<TransferRateOptionToken | null>;
    set(
      token: string,
      data: TransferRateOptionToken,
      ttlSeconds?: number
    ): Promise<void>;
  };
}
