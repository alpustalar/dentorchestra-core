import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@common/infrastructure/date-time/date-time.manager';
import { HotelRateOptionToken } from '@modules/crm/health-tourism/hotel/domain/contracts';
import { IHotelCacheService } from '@modules/crm/health-tourism/hotel/domain/interfaces/hotel-cache.service.interface';

const KEYS = {
  // Anahtar **kiracı kapsamlı**: başka bir kliniğin optionId'si burada hiç bulunmaz
  // (çarpışma da kiracı içinde kalır). Sahiplik kontrolü kaydın içinde ayrıca yapılır —
  // anahtar bir adres, yetki değil.
  RATE_OPTION: (clinicId: string, token: string) =>
    `hotel:rate-option:${clinicId}:${token}`,
};

@Injectable()
export class HotelCacheService implements IHotelCacheService {
  private readonly rateOptionTtl = DateTimeManager.toSeconds({
    minutes: 15,
  });

  constructor(@InjectRedis() private readonly redis: Redis) {}

  get hotelRateOption() {
    return {
      get: async (
        clinicId: string,
        token: string
      ): Promise<HotelRateOptionToken | null> => {
        const raw = await this.redis.get(KEYS.RATE_OPTION(clinicId, token));
        if (!raw) return null;

        try {
          // Cache dışarıdan gelen bir kaynak değil; yalnız bu servisin `set`'i yazar.
          // Şema sürümü değişip eski kayıt kalırsa bozuk JSON'daki gibi `null` dönmez —
          // bu yüzden anahtar TTL'i (15 dk) sürüm kayması penceresini de kapatır.
          return JSON.parse(raw) as HotelRateOptionToken;
        } catch {
          return null;
        }
      },

      set: async (
        token: string,
        data: HotelRateOptionToken,
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
    };
  }
}
