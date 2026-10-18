import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import {
  TransferAvailabilityItem,
  TransferRateOptionToken,
} from '@modules/crm/health-tourism/transfer/domain/contracts/hotelbeds-transfer-booking';
import { ITransferCacheService } from '@modules/crm/health-tourism/transfer/domain/interfaces/transfer-cache.service.interface';

const KEYS = {
  AVAILABILITY: (paramsHash: string) => `transfer:availability:${paramsHash}`,
  // AI asistanı için optionId → HotelBeds transfer rateKey + bağlam. Anahtar
  // **kiracı kapsamlı** (bkz. `HotelCacheService`): başka kliniğin teklifi burada yok.
  RATE_OPTION: (clinicId: string, token: string) =>
    `transfer:rate-option:${clinicId}:${token}`,
};

@Injectable()
export class TransferCacheService implements ITransferCacheService {
  private readonly availabilityTtl = DateTimeManager.toSeconds({ minutes: 10 });
  private readonly rateOptionTtl = DateTimeManager.toSeconds({ minutes: 15 });

  constructor(@InjectRedis() private readonly redis: Redis) {}

  get transferAvailability() {
    return {
      get: async (
        paramsHash: string
      ): Promise<TransferAvailabilityItem[] | null> => {
        const raw = await this.redis.get(KEYS.AVAILABILITY(paramsHash));
        if (!raw) return null;
        try {
          return JSON.parse(raw) as TransferAvailabilityItem[];
        } catch {
          return null;
        }
      },
      set: async (
        paramsHash: string,
        data: TransferAvailabilityItem[]
      ): Promise<void> => {
        await this.redis.set(
          KEYS.AVAILABILITY(paramsHash),
          JSON.stringify(data),
          'EX',
          this.availabilityTtl
        );
      },
    };
  }

  get transferRateOption() {
    return {
      set: async (
        token: string,
        data: TransferRateOptionToken,
        ttlSeconds = this.rateOptionTtl
      ): Promise<void> => {
        await this.redis.set(
          // Anahtarın kiracısı kaydın sahibinden gelir: ikisi **ayrışamaz**.
          KEYS.RATE_OPTION(data.owner.clinicId, token),
          JSON.stringify(data),
          'EX',
          ttlSeconds
        );
      },
      get: async (
        clinicId: string,
        token: string
      ): Promise<TransferRateOptionToken | null> => {
        const raw = await this.redis.get(KEYS.RATE_OPTION(clinicId, token));
        if (!raw) return null;
        try {
          return JSON.parse(raw) as TransferRateOptionToken;
        } catch {
          return null;
        }
      },
    };
  }
}
