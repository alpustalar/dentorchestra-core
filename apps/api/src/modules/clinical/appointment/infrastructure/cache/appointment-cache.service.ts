import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { DateTimeManager } from '@shared/common/utils/date-time/date-time.manager';
import { IAppointmentCacheService } from '@modules/clinical/appointment/domain/interfaces/appointment-cache.service.interface';

declare module 'ioredis' {
  interface Redis {
    releaseSlotLock(key: string, holderId: string): Promise<number>;
    refreshSlotLock(
      key: string,
      holderId: string,
      ttlSeconds: string
    ): Promise<number>;
  }
}

const KEYS = {
  // Cluster uyumluluğu için {providerId} hash tag formatı
  SLOT_LOCK: (providerId: string, startTimeIso: string) =>
    `appointment:slot-lock:v1:{${providerId}}:${startTimeIso}`,
};

const RELEASE_LOCK_LUA = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

// nil-check içeren refresh scripti
const REFRESH_LOCK_LUA = `
  local owner = redis.call("get", KEYS[1])
  if owner == false then
    return 0
  end
  if owner ~= ARGV[1] then
    return 0
  end
  return redis.call("expire", KEYS[1], ARGV[2])
`;

export type SlotAcquireResult =
  | {
      status: 'acquired';
      lockedUntilIso: string;
      lockedUntilTimestamp: number;
    }
  | {
      status: 'locked';
    };

export type SlotRefreshResult =
  | {
      status: 'refreshed';
      lockedUntilIso: string;
      lockedUntilTimestamp: number;
    }
  | {
      status: 'expired_or_stolen';
    };

@Injectable()
export class AppointmentCacheService implements IAppointmentCacheService {
  private readonly slotLockTtl = DateTimeManager.toSeconds({ minutes: 2 });

  constructor(@InjectRedis() private readonly redis: Redis) {
    // 1. defineCommand async bir I/O işlemi değildir, sadece client objesine metot ekler.
    // OnModuleInit yerine constructor'da tanımlamak lifecycle bağımlılığını kaldırır.
    this.redis.defineCommand('releaseSlotLock', {
      numberOfKeys: 1,
      lua: RELEASE_LOCK_LUA,
    });

    this.redis.defineCommand('refreshSlotLock', {
      numberOfKeys: 1,
      lua: REFRESH_LOCK_LUA,
    });
  }

  get slotLockTtlSeconds(): number {
    return this.slotLockTtl;
  }

  get slotLock() {
    return {
      /**
       * Slotu ilk defa kilitlemeyi dener veya eldeki kilidi tazeler (Idempotent Acquire).
       */
      acquire: async (payload: {
        providerId: string;
        startTimeIso: string;
        holderId: string;
        ttlSeconds?: number;
      }): Promise<SlotAcquireResult> => {
        const key = KEYS.SLOT_LOCK(payload.providerId, payload.startTimeIso);
        const ttl = payload.ttlSeconds ?? this.slotLockTtlSeconds;

        // 1. İlk defa kilitlemeyi dene (SET NX EX)
        const result = await this.redis.set(
          key,
          payload.holderId,
          'EX',
          ttl,
          'NX'
        );

        if (result === 'OK') {
          return this.buildAcquiredResponse(ttl);
        }

        // 2. Zaten kilitliyse ve tutan bizsek atomik uzat
        const refreshed = await this.redis.refreshSlotLock(
          key,
          payload.holderId,
          ttl.toString()
        );

        if (refreshed === 1) {
          return this.buildAcquiredResponse(ttl);
        }

        return { status: 'locked' };
      },

      /**
       * Uzun süren akışlarda (örn: checkout/ödeme ekranı) kilidi canlı tutmak için
       * frontend/background worker tarafından çağrılır.
       */
      refresh: async (payload: {
        providerId: string;
        startTimeIso: string;
        holderId: string;
        ttlSeconds?: number;
      }): Promise<SlotRefreshResult> => {
        const key = KEYS.SLOT_LOCK(payload.providerId, payload.startTimeIso);
        const ttl = payload.ttlSeconds ?? this.slotLockTtlSeconds;

        const refreshed = await this.redis.refreshSlotLock(
          key,
          payload.holderId,
          ttl.toString()
        );

        if (refreshed === 1) {
          const { lockedUntilIso, lockedUntilTimestamp } =
            this.calculateLockExpiry(ttl);

          return {
            status: 'refreshed',
            lockedUntilIso,
            lockedUntilTimestamp,
          };
        }

        return { status: 'expired_or_stolen' };
      },

      /**
       * Kilidi yalnız tutan holder (UUID sahibi) serbest bırakır.
       * Başarısız olması bir exception/hata kaskadı tetiklememeli.
       */
      release: async (payload: {
        providerId: string;
        startTimeIso: string;
        holderId: string;
      }): Promise<void> => {
        const key = KEYS.SLOT_LOCK(payload.providerId, payload.startTimeIso);
        await this.redis.releaseSlotLock(key, payload.holderId);
      },
    };
  }

  /**
   *  kilit bitiş zamanını hesaplar.
   */
  private calculateLockExpiry(ttlSeconds: number) {
    const lockedUntilDate = DateTimeManager.plus({ seconds: ttlSeconds });

    return {
      lockedUntilIso: DateTimeManager.toIsoString(lockedUntilDate),
      lockedUntilTimestamp: DateTimeManager.toMillis(lockedUntilDate),
    };
  }

  private buildAcquiredResponse(ttlSeconds: number): SlotAcquireResult {
    const { lockedUntilIso, lockedUntilTimestamp } =
      this.calculateLockExpiry(ttlSeconds);

    return {
      status: 'acquired',
      lockedUntilIso,
      lockedUntilTimestamp,
    };
  }
}
